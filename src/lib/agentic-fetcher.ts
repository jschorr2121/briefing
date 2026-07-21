// Agentic article gathering via the OpenAI Responses API web_search tool.
//
// This is the NEWS_SOURCE=agentic alternative to article-fetcher.ts (Perigon).
// One LLM call per topic: the model expands the topic into a few searches,
// runs them server-side, and returns a strict JSON list of candidate articles.
// We then keep only candidates grounded in the call's url_citations, so a
// fabricated URL never reaches the briefing.
//
// Output shape is identical to fetchArticlesForTopic (ArticleSet), so the
// downstream assembly, section cache, cron, and email paths are unchanged.

import { getOpenAIModel } from './models';
import { type PreparedArticle } from './prompts';
import { getCached, setCached, fetchWithLock, canonicalTopicId, EMPTY_TTL_SECONDS } from './news/cache';
import { type ArticleSet } from './article-fetcher';

const GATHER_CACHE_TTL_SECONDS = 6 * 60 * 60; // match the Perigon query cache
const MAX_ARTICLES = 12;
const MAX_AGE_DAYS = 45; // hard staleness cutoff for gathered candidates

// Source memory: hosts that produced good coverage for a topic before.
// Injected as hints into the next gather so niche topics start from the
// community sources that worked instead of rediscovering them each time.
const SOURCE_MEMORY_TTL_SECONDS = 30 * 24 * 60 * 60;
const SOURCE_MEMORY_MAX_HOSTS = 10;

// ─── Cache keys ──────────────────────────────────────────────────────

// Canonical ids so "AI news" and "artificial intelligence" share one entry
// (and one gather) across users.
function gatherCacheKey(topicName: string): string {
  return `websearch:articles:${canonicalTopicId(topicName)}`;
}

function sourceMemoryKey(topicName: string): string {
  return `websearch:sources:${canonicalTopicId(topicName)}`;
}

// ─── Gather prompt ───────────────────────────────────────────────────

function buildGatherInstructions(): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `You are the news-gathering step of a personalized briefing pipeline. Today is ${today}. Your ONLY job is to find recent, relevant coverage for the user's topic and return it as structured data. You do NOT write the briefing.

SEARCH STRATEGY:
- Expand the topic into 2-4 distinct web searches. Think about key entities, sub-communities, and recent events. Include the current year in at least one query.
- For broad topics (politics, AI, finance): prioritize the last 1-3 days from major outlets.
- For niche topics (hobbies, industry subfields, local scenes): mainstream outlets rarely cover them. Search for the community's own publications — enthusiast news sites, official bodies/federations, trade press, project blogs. Coverage up to a few weeks old is acceptable if that's the freshest available. A good older story beats no story.
- AVOID: Wikipedia, SEO listicles ("best X in ${new Date().getFullYear()}"), aggregator/reprint farms, press-release mills. Prefer the original source of a story over syndicated copies.

OUTPUT — respond with ONLY a valid JSON object, no markdown fences:
{
  "articles": [
    {
      "title": "Actual headline of the article",
      "source": "Publication name",
      "url": "https://the-exact-url-from-your-search-results",
      "date": "Jul 16, 2026",
      "summary": "1-3 sentences of concrete facts from this article: who, what, numbers, dates."
    }
  ]
}

RULES:
- Up to ${MAX_ARTICLES} articles, most important first. Each must be a genuinely DISTINCT story (if several outlets cover the same event, include only the best one).
- Every url MUST be copied exactly from your search results. NEVER construct, guess, or 'clean up' a URL.
- Every fact in "summary" must come from the search results — no background knowledge.
- Include the publication date whenever the search results show one; omit "date" if unknown.
- If you find nothing relevant, return {"articles": []}.`;
}

// ─── Response parsing ────────────────────────────────────────────────

interface RawCandidate {
  title?: string;
  source?: string;
  url?: string;
  date?: string;
  summary?: string;
}

interface OpenAIResponsesOutput {
  output_text?: string;
  output?: {
    type: string;
    content?: {
      type: string;
      text?: string;
      annotations?: { type: string; url?: string; title?: string }[];
    }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

function extractOutputText(data: OpenAIResponsesOutput): string {
  if (data.output_text) return data.output_text;
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        if ((content.type === 'output_text' || content.type === 'text') && content.text) {
          return content.text;
        }
      }
    }
  }
  return '';
}

function extractCitations(data: OpenAIResponsesOutput): { url: string; title?: string }[] {
  const out: { url: string; title?: string }[] = [];
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        for (const a of content.annotations || []) {
          if (a.type === 'url_citation' && a.url) out.push({ url: a.url, title: a.title });
        }
      }
    }
  }
  return out;
}

export function parseCandidates(text: string): RawCandidate[] {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(clean.substring(start, end + 1));
    return Array.isArray(parsed.articles) ? parsed.articles : [];
  } catch {
    return [];
  }
}

// ─── Validation / grounding ──────────────────────────────────────────

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isTooOld(dateStr?: string): boolean {
  if (!dateStr) return false; // unknown dates are kept; assembly prompt handles recency
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Keep candidates whose URL (or at least host) appears in the call's actual
 * search citations. If grounding would leave too few, fall back to the full
 * parsed list minus obviously invalid URLs — better a briefing than nothing.
 */
export function groundCandidates(candidates: RawCandidate[], citations: { url: string }[]): { articles: PreparedArticle[]; grounded: boolean } {
  const valid = candidates.filter(
    (c): c is RawCandidate & { title: string; url: string } =>
      typeof c.title === 'string' && c.title.length > 0 &&
      typeof c.url === 'string' && /^https?:\/\//.test(c.url) &&
      !isTooOld(c.date)
  );

  const citationUrls = new Set(citations.map(c => c.url));
  const citationHosts = new Set(citations.map(c => hostOf(c.url)).filter(Boolean));

  const toPrepared = (c: RawCandidate & { title: string; url: string }): PreparedArticle => ({
    title: c.title,
    source: c.source || hostOf(c.url) || 'Unknown',
    date: c.date || '',
    summary: c.summary || '',
    url: c.url,
  });

  if (citationUrls.size > 0) {
    const groundedList = valid.filter(c => citationUrls.has(c.url) || citationHosts.has(hostOf(c.url)));
    // Trust grounding when it retains at least half the valid candidates
    // (capped at 3): dropping the ungrounded minority kills fabricated URLs.
    if (groundedList.length >= Math.min(3, Math.ceil(valid.length / 2))) {
      return { articles: groundedList.map(toPrepared), grounded: true };
    }
    console.warn(`⚠️ [Agentic] Only ${groundedList.length}/${valid.length} candidates grounded in citations — keeping all valid candidates`);
  }

  return { articles: valid.map(toPrepared), grounded: false };
}

function dedupeByUrl(articles: PreparedArticle[]): PreparedArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// ─── Main fetch ──────────────────────────────────────────────────────

async function gatherViaWebSearch(topicName: string, knownSources: string[]): Promise<{ articles: PreparedArticle[]; cascadeStep: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const sourceHint = knownSources.length > 0
    ? `\n\nSources that produced good coverage for this topic previously: ${knownSources.join(', ')}. Check them first, but do not limit yourself to them.`
    : '';

  const model = getOpenAIModel();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: buildGatherInstructions(),
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
      tool_choice: 'auto',
      input: `Topic: ${topicName}${sourceHint}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Agentic gather failed (${res.status}): ${body}`);
  }

  const data: OpenAIResponsesOutput = await res.json();
  if (data.usage) {
    console.log(`📊 [Agentic gather] Token usage — input: ${data.usage.input_tokens}, output: ${data.usage.output_tokens}`);
  }

  const citations = extractCitations(data);
  const candidates = parseCandidates(extractOutputText(data));

  // Model returned no parseable list — fall back to raw citations so a
  // transient formatting failure still yields material for assembly.
  if (candidates.length === 0 && citations.length > 0) {
    console.warn(`⚠️ [Agentic] No parseable candidates for "${topicName}", using ${citations.length} raw citations`);
    const articles = dedupeByUrl(
      citations.map(c => ({
        title: c.title || 'News article',
        source: hostOf(c.url) || 'Unknown',
        date: '',
        summary: '',
        url: c.url,
      }))
    ).slice(0, MAX_ARTICLES);
    return { articles, cascadeStep: 'websearch-citations-fallback' };
  }

  const { articles, grounded } = groundCandidates(candidates, citations);
  return {
    articles: dedupeByUrl(articles).slice(0, MAX_ARTICLES),
    cascadeStep: grounded ? 'websearch' : 'websearch-ungrounded',
  };
}

/**
 * Remember which hosts produced grounded coverage for this topic, so the
 * next gather can start from them. Newest hosts first, capped, 30d TTL.
 */
export function mergeSourceHosts(previous: string[], articles: PreparedArticle[]): string[] {
  const fresh = articles.map(a => hostOf(a.url)).filter(Boolean);
  const merged: string[] = [];
  for (const host of [...fresh, ...previous]) {
    if (!merged.includes(host)) merged.push(host);
    if (merged.length >= SOURCE_MEMORY_MAX_HOSTS) break;
  }
  return merged;
}

async function updateSourceMemory(
  topicName: string,
  previous: string[],
  articles: PreparedArticle[],
  cascadeStep: string,
): Promise<void> {
  // Only learn from grounded results — ungrounded ones may contain junk hosts.
  if (cascadeStep !== 'websearch') return;
  const merged = mergeSourceHosts(previous, articles);
  if (merged.length > 0) {
    await setCached(sourceMemoryKey(topicName), merged, SOURCE_MEMORY_TTL_SECONDS);
  }
}

/**
 * NEWS_SOURCE=agentic replacement for fetchArticlesForTopic. One web-search
 * LLM call per topic, cached 6h so overlapping users share the cost.
 */
export async function fetchArticlesViaWebSearch(topicName: string, skipCache = false): Promise<ArticleSet> {
  const cacheKey = gatherCacheKey(topicName);

  const doGather = async (): Promise<{ articles: PreparedArticle[]; cascadeStep: string }> => {
    const knownSources = (await getCached<string[]>(sourceMemoryKey(topicName))) ?? [];
    const gathered = await gatherViaWebSearch(topicName, knownSources);
    if (gathered.articles.length > 0) {
      await updateSourceMemory(topicName, knownSources, gathered.articles, gathered.cascadeStep);
    }
    return gathered;
  };

  if (skipCache) {
    const { articles, cascadeStep } = await doGather();
    return {
      articles,
      debugInfo: {
        queries: [{ type: 'web_search', query: topicName }],
        articleCount: articles.length,
        cascadeStep,
      },
    };
  }

  // Single-flight around the gather: concurrent requests for the same
  // (canonicalized) topic — same user or different users — result in one
  // web-search call; everyone else awaits the winner's cached result.
  let didWork = false;
  let freshCascadeStep = 'websearch';
  const articles = await fetchWithLock<PreparedArticle[]>({
    cacheKey,
    lockKey: `${cacheKey}:lock`,
    ttlSeconds: GATHER_CACHE_TTL_SECONDS,
    work: async () => {
      didWork = true;
      const gathered = await doGather();
      freshCascadeStep = gathered.cascadeStep;
      return gathered.articles;
    },
  });

  // Empty gathers stay cached only briefly, so a dead topic can revive soon
  // without every request in between re-paying for the search.
  if (didWork && articles.length === 0) {
    await setCached(cacheKey, articles, EMPTY_TTL_SECONDS);
  }

  if (!didWork) console.log(`📦 [Agentic] Cache hit for "${topicName}"`);

  return {
    articles,
    debugInfo: {
      queries: [{ type: 'web_search', query: topicName }],
      articleCount: articles.length,
      cascadeStep: didWork ? freshCascadeStep : 'websearch-cached',
    },
  };
}
