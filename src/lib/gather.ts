// Article gathering: Brave News primary, Exa as the niche/sparse fallback.
//
// Measured Oct 19 2026 (scratch A/B over AI & Tech, World News, SMRs,
// speedcubing, mechanical keyboards):
//   - Brave News: best for mainstream (AP/CNBC/Guardian/World Nuclear News),
//     $5/1k, but sparse on niche topics (3 hits for speedcubing, one junk).
//   - Exa `category: news`: best on niche (speedcubersdigest, speedsolving.com,
//     UKCA, WCA) but noisy: other languages, classified ads, hub pages.
//     $7/1k — so it runs only when Brave comes back thin.
//   - Brave Web and Exa-without-category return Wikipedia and section pages.
//   - OpenAI web_search ($10/1k + 10–30s, hung to its 60s timeout in the
//     live run) is gone; Exa covers the niche case cheaper and in ~2s.
// Only compact title+snippet text reaches an LLM. Two tiny nano calls per
// gather (query planner, relevance gate) cost ≈ $0.0003 combined.

import { type PreparedArticle } from './prompts';
import { getPlannerModel } from './models';
import { setCached, fetchWithLock, canonicalTopicId, EMPTY_TTL_SECONDS, TOPIC_TTL_SECONDS } from './news/cache';

const MAX_ARTICLES = 12;
const RESULTS_PER_QUERY = 10;
const MAX_QUERIES = 3;
const MAX_AGE_DAYS = 45;
const SNIPPET_MAX_CHARS = 400;
const MAX_PER_HOST = 3;
// Below this many relevant articles the topic is treated as niche and Exa
// is consulted too. Brave gave 3 for "speedcubing", 10 for mainstream topics.
const SPARSE_THRESHOLD = 5;
const EXA_LOOKBACK_DAYS = 14;
// Reference sites and content-farm aggregators seen leading briefings in the
// Oct 2026 live runs. ponytail: a hand list; grow it from logs, swap for a
// source-quality score if it passes ~30 entries.
const BLOCKED_HOSTS = [
  'wikipedia.org', 'wikimedia.org',
  'archyde.com', 'europesays.com', 'view.edu.pl', 'tech-insider.org',
];

export interface ArticleSet {
  articles: PreparedArticle[];
  debugInfo: {
    queries: { type: string; query: string }[];
    articleCount: number;
    cascadeStep?: string;
  };
}

// ─── Brave rate limiter ──────────────────────────────────────────────
// The Free plan allows 1 request/second; the live run fired 8 queries at
// once and lost half to 429s. All Brave calls in this process go through
// one gate spaced BRAVE_MIN_INTERVAL_MS apart (set to 0 on a paid plan).
// ponytail: per-process gate, not shared across serverless instances; the
// 429 retry below covers the residual. Move to a Redis token bucket if
// instances multiply.
const BRAVE_MIN_INTERVAL_MS = Number(process.env.BRAVE_MIN_INTERVAL_MS ?? 1100);
let braveGate: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function throttledBrave<T>(fn: () => Promise<T>): Promise<T> {
  const run = braveGate.then(() => sleep(BRAVE_MIN_INTERVAL_MS)).then(fn);
  braveGate = run.catch(() => undefined);
  return run;
}

// ─── Small OpenAI chat helper (planner + relevance gate) ─────────────

async function nanoJson(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: getPlannerModel(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(clean.substring(start, end + 1));
  } catch {
    return null;
  }
}

// ─── Query planning ──────────────────────────────────────────────────

export function buildPlannerPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  // Short entity-anchored queries measurably beat essay-style ones: in the
  // Jul 2026 A/B, long queries pulled SEO blogs out of Brave for "Finance".
  return `You expand a news-briefing topic into search queries for a news search API. Today is ${today}.

- Return 1-2 distinct queries covering the topic's key angles (${MAX_QUERIES} only if the topic genuinely spans that many separate angles). Each query costs money.
- Write queries the way a news editor would: SHORT keyword phrases (2-6 words, under 60 characters) anchored on concrete entities — "Federal Reserve interest rates", "TSMC AI chips". Never long descriptive sentences: they match SEO content farms instead of news.
- For catch-all topics ("World News", "Top Stories", "Tech"), the news API already ranks by prominence: use the plain topic phrase as the first query ("world news") and at most one more for the biggest live story you know of. Never invent abstract angles ("global conflicts ceasefires UN") — they surface think-tank and aggregator pages instead of the day's news.
- For niche topics (hobbies, industry subfields), add the community's proper names (federations, flagship sites, jargon).
- Include the current year in at most one query.

Respond with ONLY valid JSON: {"queries": ["...", "..."]}`;
}

export function parsePlannedQueries(text: string, topicName: string): string[] {
  const parsed = extractJson(text) as { queries?: unknown } | null;
  if (parsed && Array.isArray(parsed.queries)) {
    const queries = parsed.queries
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .map(q => q.trim())
      .slice(0, MAX_QUERIES);
    if (queries.length > 0) return queries;
  }
  return [topicName];
}

async function planQueries(topicName: string): Promise<string[]> {
  try {
    return parsePlannedQueries(await nanoJson(buildPlannerPrompt(), `Topic: ${topicName}`), topicName);
  } catch (err) {
    console.warn(`⚠️ [Gather] Query planning failed for "${topicName}", using topic as query:`, err);
    return [topicName];
  }
}

// ─── Relevance gate ──────────────────────────────────────────────────
// Search APIs keyword-match: Brave returned FIFA articles for "speedcubing";
// Exa returns Finnish classifieds for "mechanical keyboards". One tiny call
// over titles only (~300 tokens) drops the obvious junk. Fails open.

export function buildRelevancePrompt(topicName: string): string {
  return `You are filtering news search results for an English-language briefing about: "${topicName}".

You will get a numbered list of headlines with their site. Reply with the numbers to KEEP.
Keep anything plausibly relevant to the topic — when unsure, keep it.
Drop a headline only if it is clearly one of:
- about an unrelated subject that merely matched keywords
- not in English
- a product listing, classified ad, coupon, deal, or price-tracking page
- a site section/hub/index page or a generic evergreen explainer rather than a dated news story

Respond with ONLY valid JSON: {"keep": [1, 2, ...]}`;
}

export function parseKeepIndices(text: string, count: number): number[] | null {
  const parsed = extractJson(text) as { keep?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.keep)) return null;
  const indices = parsed.keep
    .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= count)
    .map(n => n - 1);
  return [...new Set<number>(indices)];
}

async function filterRelevant(topicName: string, articles: PreparedArticle[]): Promise<PreparedArticle[]> {
  if (articles.length === 0) return articles;
  try {
    const list = articles.map((a, i) => `${i + 1}. ${a.title} (${a.source})`).join('\n');
    const kept = parseKeepIndices(await nanoJson(buildRelevancePrompt(topicName), list), articles.length);
    if (kept === null) return articles;
    if (kept.length < articles.length) {
      console.log(`🚧 [Gather] Relevance gate kept ${kept.length}/${articles.length} for "${topicName}"`);
    }
    return kept.map(i => articles[i]);
  } catch (err) {
    console.warn(`⚠️ [Gather] Relevance gate failed for "${topicName}" — keeping all:`, err);
    return articles;
  }
}

// ─── Raw result → PreparedArticle ────────────────────────────────────

export interface RawSearchResult {
  title?: string;
  url?: string;
  source?: string;
  date?: string;
  snippet?: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** "2 days ago" / ISO / anything Date.parse accepts → "Mon D, YYYY". */
export function normalizeDate(raw: string | undefined): string {
  if (!raw) return '';
  const rel = raw.match(/^(\d+)\s+(minute|hour|day|week|month)s?\s+ago$/i);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unitMs: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 7 * 86_400_000,
      month: 30 * 86_400_000,
    };
    return new Date(Date.now() - n * unitMs[rel[2].toLowerCase()]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return raw;
}

function isTooOld(dateStr: string): boolean {
  if (!dateStr) return false; // unknown dates are kept; assembly handles recency
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > MAX_AGE_DAYS * 86_400_000;
}

/** Validate, dedupe (URL + title), cap per host and total. */
export function prepareSearchResults(raw: RawSearchResult[], limit = MAX_ARTICLES): PreparedArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const hostCounts = new Map<string, number>();
  const out: PreparedArticle[] = [];

  for (const r of raw) {
    if (!r.title || !r.url || !/^https?:\/\//.test(r.url)) continue;
    let pathname = '';
    try {
      pathname = new URL(r.url).pathname;
    } catch {
      continue;
    }
    if (pathname === '/' || pathname === '') continue; // landing pages aren't articles

    const host = hostOf(r.url);
    if (BLOCKED_HOSTS.some(b => host === b || host.endsWith('.' + b))) continue;

    const date = normalizeDate(r.date);
    if (isTooOld(date)) continue;

    const urlKey = r.url.replace(/[?#].*$/, '');
    const titleKey = r.title.toLowerCase().trim();
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;

    const hostCount = hostCounts.get(host) ?? 0;
    if (hostCount >= MAX_PER_HOST) continue;
    hostCounts.set(host, hostCount + 1);
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);

    out.push({
      title: r.title,
      source: r.source || host || 'Unknown',
      date,
      summary: (r.snippet || '').substring(0, SNIPPET_MAX_CHARS),
      url: r.url,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Providers ───────────────────────────────────────────────────────

async function searchBrave(query: string): Promise<RawSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(RESULTS_PER_QUERY),
    freshness: 'pw',
    country: 'US',
    extra_snippets: 'true',
  });
  const res = await fetch(`https://api.search.brave.com/res/v1/news/search?${params}`, {
    headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY!, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brave News HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = await res.json();
  interface BraveNewsResult {
    title?: string;
    url?: string;
    description?: string;
    age?: string;
    page_age?: string;
    meta_url?: { netloc?: string };
    extra_snippets?: string[];
  }
  return ((data.results ?? []) as BraveNewsResult[]).map(r => ({
    title: r.title,
    url: r.url,
    source: r.meta_url?.netloc?.replace(/^www\./, ''),
    date: r.age ?? r.page_age,
    snippet: [r.description, r.extra_snippets?.join(' ')].filter(Boolean).join(' '),
  }));
}

async function searchExa(query: string): Promise<RawSearchResult[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': process.env.EXA_API_KEY!, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      query,
      type: 'auto',
      category: 'news',
      numResults: RESULTS_PER_QUERY,
      contents: { highlights: { numSentences: 2 } },
      startPublishedDate: new Date(Date.now() - EXA_LOOKBACK_DAYS * 86_400_000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Exa HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = await res.json();
  interface ExaResult {
    title?: string;
    url?: string;
    publishedDate?: string;
    highlights?: string[];
  }
  return ((data.results ?? []) as ExaResult[]).map(r => ({
    title: r.title,
    url: r.url,
    date: r.publishedDate,
    snippet: r.highlights?.join(' '),
  }));
}

async function braveAll(queries: string[]): Promise<RawSearchResult[]> {
  const raw: RawSearchResult[] = [];
  for (const q of queries) {
    try {
      raw.push(...(await throttledBrave(() => searchBrave(q))));
    } catch (err) {
      if (String(err).includes('429')) {
        await sleep(1200);
        try {
          raw.push(...(await throttledBrave(() => searchBrave(q))));
          continue;
        } catch (retryErr) {
          err = retryErr;
        }
      }
      console.warn(`⚠️ [Gather] Brave query failed ("${q}"):`, err);
    }
  }
  return raw;
}

async function exaAll(queries: string[]): Promise<RawSearchResult[]> {
  const settled = await Promise.allSettled(queries.map(searchExa));
  const raw: RawSearchResult[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') raw.push(...s.value);
    else console.warn(`⚠️ [Gather] Exa query failed ("${queries[i]}"):`, s.reason);
  });
  return raw;
}

// ─── Main gather ─────────────────────────────────────────────────────

async function gather(topicName: string): Promise<{ articles: PreparedArticle[]; queries: string[]; provider: string }> {
  const hasBrave = !!process.env.BRAVE_API_KEY;
  const hasExa = !!process.env.EXA_API_KEY;
  if (!hasBrave && !hasExa) throw new Error('Gathering requires BRAVE_API_KEY and/or EXA_API_KEY');

  const queries = await planQueries(topicName);
  let provider = '';
  let articles: PreparedArticle[] = [];

  if (hasBrave) {
    provider = 'brave';
    articles = await filterRelevant(topicName, prepareSearchResults(await braveAll(queries)));
  }

  // Niche backstop: Exa's neural index carries the community sites a news
  // index misses. Brave results stay first so mainstream coverage leads.
  if (hasExa && articles.length < SPARSE_THRESHOLD) {
    const exaRaw = await exaAll(queries.slice(0, 2));
    const exaArticles = await filterRelevant(topicName, prepareSearchResults(exaRaw));
    if (exaArticles.length > 0) {
      provider = provider ? `${provider}+exa` : 'exa';
      articles = prepareSearchResults([...articles, ...exaArticles].map(a => ({ ...a, snippet: a.summary })));
    }
  }

  console.log(`🔎 [Gather] ${provider || 'none'}: ${queries.length} queries → ${articles.length} articles for "${topicName}"`);
  return { articles, queries, provider };
}

/**
 * Gather recent articles for a topic. Cached and single-flighted per
 * canonical topic (6h) so overlapping users and the cron share one gather.
 */
export async function gatherArticles(topicName: string, skipCache = false): Promise<ArticleSet> {
  const cacheKey = `gather:${canonicalTopicId(topicName)}`;
  const toSet = (articles: PreparedArticle[], queries: string[], cascadeStep: string): ArticleSet => ({
    articles,
    debugInfo: { queries: queries.map(q => ({ type: 'search', query: q })), articleCount: articles.length, cascadeStep },
  });

  if (skipCache) {
    const g = await gather(topicName);
    return toSet(g.articles, g.queries, g.provider);
  }

  let fresh: { queries: string[]; provider: string } | null = null;
  const articles = await fetchWithLock<PreparedArticle[]>({
    cacheKey,
    lockKey: `${cacheKey}:lock`,
    ttlSeconds: TOPIC_TTL_SECONDS,
    work: async () => {
      const g = await gather(topicName);
      fresh = { queries: g.queries, provider: g.provider };
      return g.articles;
    },
  });

  if (fresh) {
    const f = fresh as { queries: string[]; provider: string };
    if (articles.length === 0) await setCached(cacheKey, articles, EMPTY_TTL_SECONDS);
    return toSet(articles, f.queries, f.provider);
  }
  console.log(`📦 [Gather] Cache hit for "${topicName}"`);
  return toSet(articles, [topicName], 'cached');
}
