// Article gathering via web-search APIs called directly (NEWS_SOURCE=search-api).
//
// The cost problem with the agentic path (agentic-fetcher.ts) is that the
// LLM's built-in web_search TOOL feeds full page content into the model's
// context and bills the tool call at $10/1k on top — the gather step ends up
// dominating briefing cost. Here we invert control: our code calls a search
// API (Brave News primary; Tavily/Exa fallbacks), and only compact
// title+snippet text ever reaches an LLM. The only LLM calls left are a
// cheap query-planning call here (default gpt-5.4-nano) and the existing
// assembly call downstream.
//
// Output shape is identical to the other fetchers (ArticleSet with
// PreparedArticle[]), so assembly, section cache, cron, and email paths are
// unchanged. Ported in part from scripts/diagnostic-compare/variants/
// (brave-direct.ts, tavily-agent.ts, exa-direct.ts).

import { type PreparedArticle } from './prompts';
import { setCached, fetchWithLock, canonicalTopicId, EMPTY_TTL_SECONDS, TOPIC_TTL_SECONDS } from './news/cache';
import { type ArticleSet } from './article-fetcher';

const MAX_ARTICLES = 12;
const RESULTS_PER_QUERY = 10;
const MAX_QUERIES = 3;
const MAX_AGE_DAYS = 45; // same staleness cutoff as the agentic path
const SNIPPET_MAX_CHARS = 400; // context control: this cap is the whole point
const MAX_PER_HOST = 3; // source diversity: live A/B saw 5/12 articles from one host
const MAX_QUERY_CHARS = 100; // NewsData rejects longer queries (HTTP 422)
// Below this many gathered articles, the topic is too sparse for the search
// API and the agentic web-search gather takes over (quality backstop).
const AGENTIC_FALLBACK_THRESHOLD = 4;

export type SearchProvider = 'brave' | 'tavily' | 'exa' | 'newsdata';

// ─── Provider selection ──────────────────────────────────────────────

export function activeProvider(): SearchProvider | null {
  const forced = process.env.SEARCH_API_PROVIDER?.toLowerCase();
  if (forced === 'brave' || forced === 'tavily' || forced === 'exa' || forced === 'newsdata') return forced;
  if (process.env.BRAVE_API_KEY) return 'brave';
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.EXA_API_KEY) return 'exa';
  if (process.env.NEWSDATA_API_KEY) return 'newsdata';
  return null;
}

// ─── Cache keys ──────────────────────────────────────────────────────

function gatherCacheKey(topicName: string): string {
  return `searchapi:articles:${canonicalTopicId(topicName)}`;
}

// ─── Query planning (one cheap LLM call) ─────────────────────────────

function plannerModel(): string {
  return process.env.SEARCH_PLANNER_MODEL || 'gpt-5.4-nano';
}

export function buildPlannerPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  // Query style matters measurably: in the Jul 2026 live A/B, long essay-style
  // queries ("global central banks monetary policy decisions 2026 IMF World
  // Bank financial stability report") pulled SEO-blog matches out of Brave,
  // while short entity-anchored ones returned mainstream coverage. Each query
  // is also a billed search request, so fewer queries are directly cheaper.
  return `You expand a news-briefing topic into search queries for a news search API. Today is ${today}.

- Return 1-2 distinct queries covering the topic's key angles (${MAX_QUERIES} only if the topic genuinely spans that many separate angles). Fewer, better queries beat many overlapping ones — each query costs money.
- Write queries the way a news editor would: SHORT keyword phrases (2-6 words, under 60 characters) anchored on concrete entities — "Federal Reserve interest rates", "TSMC AI chips". Never long descriptive sentences: they match SEO content farms instead of news.
- For niche topics (hobbies, industry subfields), target the community's own outlets: add the community's proper names (federations, flagship sites, jargon) to the query.
- Include the current year in at most one query.

Respond with ONLY valid JSON, no markdown fences: {"queries": ["...", "..."]}`;
}

/** Parse the planner's response; exported for offline checks. */
export function parsePlannedQueries(text: string, topicName: string): string[] {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(clean.substring(start, end + 1));
      if (Array.isArray(parsed.queries)) {
        const queries = parsed.queries
          .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
          .map((q: string) => q.trim())
          .slice(0, MAX_QUERIES);
        if (queries.length > 0) return queries;
      }
    } catch {
      // fall through to the topic itself
    }
  }
  return [topicName];
}

async function planQueries(topicName: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [topicName]; // no planner → the topic itself is the query

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: plannerModel(),
        messages: [
          { role: 'system', content: buildPlannerPrompt() },
          { role: 'user', content: `Topic: ${topicName}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`planner HTTP ${res.status}`);
    const data = await res.json();
    if (data.usage) {
      console.log(`📊 [Search-API planner] Token usage — input: ${data.usage.prompt_tokens}, output: ${data.usage.completion_tokens}`);
    }
    return parsePlannedQueries(data.choices?.[0]?.message?.content ?? '', topicName);
  } catch (err) {
    console.warn(`⚠️ [Search-API] Query planning failed for "${topicName}", using topic as query:`, err);
    return [topicName];
  }
}

// ─── Relevance gate ──────────────────────────────────────────────────
//
// Search APIs keyword-match: the live A/B saw Brave return FIFA World Cup
// articles for "speedcubing" — 10 confident, entirely off-topic results that
// an article-count check can't catch. One tiny LLM call over the TITLES only
// (~300 tokens, ≈$0.0001 at nano rates) drops clearly-unrelated results, and
// when too few survive, the agentic fallback takes over.

export function buildRelevancePrompt(topicName: string): string {
  return `You are filtering news search results for a briefing about: "${topicName}".

You will get a numbered list of headlines. Reply with the numbers of headlines to KEEP.
- Keep anything plausibly relevant to the topic — when unsure, keep it.
- Drop only headlines CLEARLY about an unrelated subject that happened to match keywords.

Respond with ONLY valid JSON, no markdown fences: {"keep": [1, 2, ...]}`;
}

/** Parse the relevance response into 0-based indices; exported for offline checks. */
export function parseKeepIndices(text: string, count: number): number[] | null {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(clean.substring(start, end + 1));
    if (!Array.isArray(parsed.keep)) return null;
    const indices = parsed.keep
      .filter((n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= count)
      .map((n: number) => n - 1);
    return [...new Set<number>(indices)];
  } catch {
    return null;
  }
}

async function filterRelevant(topicName: string, articles: PreparedArticle[]): Promise<PreparedArticle[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || articles.length === 0) return articles;

  try {
    const list = articles.map((a, i) => `${i + 1}. ${a.title} (${a.source})`).join('\n');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: plannerModel(),
        messages: [
          { role: 'system', content: buildRelevancePrompt(topicName) },
          { role: 'user', content: list },
        ],
      }),
    });
    if (!res.ok) throw new Error(`relevance gate HTTP ${res.status}`);
    const data = await res.json();
    const kept = parseKeepIndices(data.choices?.[0]?.message?.content ?? '', articles.length);
    if (kept === null) return articles; // unparseable → fail open
    if (kept.length < articles.length) {
      console.log(`🚧 [Search-API] Relevance gate kept ${kept.length}/${articles.length} articles for "${topicName}"`);
    }
    return kept.map(i => articles[i]);
  } catch (err) {
    console.warn(`⚠️ [Search-API] Relevance gate failed for "${topicName}" — keeping all results:`, err);
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

/** "2 days ago" / "5 hours ago" → formatted date; absolute dates pass through. */
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
    const t = new Date(Date.now() - n * unitMs[rel[2].toLowerCase()]);
    return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  return Date.now() - t > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Validate, dedupe, and cap raw search results into PreparedArticle[].
 * Exported for offline checks.
 */
export function prepareSearchResults(raw: RawSearchResult[]): PreparedArticle[] {
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
    // Root/landing URLs are not article permalinks
    if (pathname === '/' || pathname === '') continue;

    const date = normalizeDate(r.date);
    if (isTooOld(date)) continue;

    const urlKey = r.url.replace(/[?#].*$/, '');
    const titleKey = r.title.toLowerCase().trim();
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;

    // Same running story from one outlet crowds out other sources (live A/B:
    // one host supplied 5 of 12 World News articles). Cap per host.
    const host = hostOf(r.url);
    const hostCount = hostCounts.get(host) ?? 0;
    if (hostCount >= MAX_PER_HOST) continue;
    hostCounts.set(host, hostCount + 1);

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);

    out.push({
      title: r.title,
      source: r.source || hostOf(r.url) || 'Unknown',
      date,
      summary: (r.snippet || '').substring(0, SNIPPET_MAX_CHARS),
      url: r.url,
    });
    if (out.length >= MAX_ARTICLES) break;
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
    headers: {
      'X-Subscription-Token': process.env.BRAVE_API_KEY!,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Brave News HTTP ${res.status}: ${await res.text().catch(() => '')}`);
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
    source: r.meta_url?.netloc,
    date: r.age ?? r.page_age,
    snippet: [r.description, r.extra_snippets?.join(' ')].filter(Boolean).join(' '),
  }));
}

async function searchTavily(query: string): Promise<RawSearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      topic: 'news',
      search_depth: 'basic',
      max_results: RESULTS_PER_QUERY,
      days: 7,
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();

  interface TavilyResult {
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
  }
  return ((data.results ?? []) as TavilyResult[]).map(r => ({
    title: r.title,
    url: r.url,
    date: r.published_date,
    snippet: r.content,
  }));
}

async function searchExa(query: string): Promise<RawSearchResult[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.EXA_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      type: 'auto',
      category: 'news',
      numResults: RESULTS_PER_QUERY,
      contents: { highlights: { numSentences: 2 } },
      startPublishedDate: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Exa HTTP ${res.status}: ${await res.text().catch(() => '')}`);
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

/** Trim a query to maxLen at a word boundary; exported for offline checks. */
export function clampQuery(query: string, maxLen: number = MAX_QUERY_CHARS): string {
  if (query.length <= maxLen) return query;
  const cut = query.substring(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.substring(0, lastSpace) : cut).trim();
}

async function searchNewsdata(query: string): Promise<RawSearchResult[]> {
  const params = new URLSearchParams({
    apikey: process.env.NEWSDATA_API_KEY!,
    q: clampQuery(query),
    language: 'en',
    prioritydomain: 'top',
    size: String(Math.min(RESULTS_PER_QUERY, 10)), // free tier caps size at 10
  });
  const res = await fetch(`https://newsdata.io/api/1/latest?${params}`);
  if (!res.ok) throw new Error(`NewsData HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();

  interface NewsdataResult {
    title?: string;
    link?: string;
    description?: string;
    pubDate?: string;
    source_name?: string;
    source_id?: string;
  }
  return ((data.results ?? []) as NewsdataResult[]).map(r => ({
    title: r.title,
    url: r.link,
    source: r.source_name ?? r.source_id,
    date: r.pubDate,
    snippet: r.description,
  }));
}

const PROVIDER_FNS: Record<SearchProvider, (q: string) => Promise<RawSearchResult[]>> = {
  brave: searchBrave,
  tavily: searchTavily,
  exa: searchExa,
  newsdata: searchNewsdata,
};

// ─── Main gather ─────────────────────────────────────────────────────

async function gatherViaSearchApi(
  topicName: string,
): Promise<{ articles: PreparedArticle[]; queries: string[]; provider: string }> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error(
      'NEWS_SOURCE=search-api requires BRAVE_API_KEY, TAVILY_API_KEY, EXA_API_KEY, or NEWSDATA_API_KEY (or SEARCH_API_PROVIDER to force one)'
    );
  }

  const queries = await planQueries(topicName);
  const search = PROVIDER_FNS[provider];

  // Sequential, not parallel: Brave enforces ~1 QPS, and the live A/B showed
  // the first of two concurrent queries 429ing. One retry after a beat
  // handles residual rate-limit blips. Two sequential ~600ms queries still
  // finish an order of magnitude faster than an agentic gather.
  const raw: RawSearchResult[] = [];
  let failures = 0;
  for (const q of queries) {
    try {
      raw.push(...(await search(q)));
    } catch (err) {
      if (String(err).includes('429')) {
        await new Promise(r => setTimeout(r, 1100));
        try {
          raw.push(...(await search(q)));
          continue;
        } catch (retryErr) {
          err = retryErr;
        }
      }
      failures++;
      console.warn(`⚠️ [Search-API] ${provider} query failed ("${q}"):`, err);
    }
  }
  if (raw.length === 0 && failures === queries.length) {
    throw new Error(`All ${provider} queries failed for "${topicName}"`);
  }

  const articles = await filterRelevant(topicName, prepareSearchResults(raw));
  console.log(
    `🔎 [Search-API] ${provider}: ${queries.length} queries → ${raw.length} raw → ${articles.length} articles for "${topicName}"`
  );

  // Hybrid quality backstop: search APIs handle mainstream topics well but
  // can come up near-empty on niche ones, where the agentic web-search gather
  // measurably shines (community sites a news index doesn't carry). Falling
  // back only when sparse keeps agentic's cost confined to the topics that
  // need it. Opt out with SEARCH_API_AGENTIC_FALLBACK=0.
  if (
    articles.length < AGENTIC_FALLBACK_THRESHOLD &&
    process.env.OPENAI_API_KEY &&
    process.env.SEARCH_API_AGENTIC_FALLBACK !== '0'
  ) {
    console.log(
      `🪃 [Search-API] Only ${articles.length} articles for "${topicName}" — falling back to agentic web-search gather`
    );
    try {
      const { fetchArticlesViaWebSearch } = await import('./agentic-fetcher');
      const agentic = await fetchArticlesViaWebSearch(topicName, true);
      if (agentic.articles.length > articles.length) {
        return { articles: agentic.articles, queries, provider: `${provider}+agentic-fallback` };
      }
    } catch (err) {
      console.warn(`⚠️ [Search-API] Agentic fallback failed for "${topicName}":`, err);
    }
  }

  return { articles, queries, provider };
}

/**
 * NEWS_SOURCE=search-api replacement for fetchArticlesForTopic. Direct
 * search-API calls with snippet-only context; cached and single-flighted
 * per canonical topic so overlapping users share one gather.
 */
export async function fetchArticlesViaSearchApi(topicName: string, skipCache = false): Promise<ArticleSet> {
  const cacheKey = gatherCacheKey(topicName);

  const toArticleSet = (articles: PreparedArticle[], queries: string[], cascadeStep: string): ArticleSet => ({
    articles,
    debugInfo: {
      queries: queries.map(q => ({ type: 'search-api', query: q })),
      articleCount: articles.length,
      cascadeStep,
    },
  });

  if (skipCache) {
    const { articles, queries, provider } = await gatherViaSearchApi(topicName);
    return toArticleSet(articles, queries, `search-api-${provider}`);
  }

  let didWork = false;
  let freshQueries: string[] = [topicName];
  let freshProvider = '';
  const articles = await fetchWithLock<PreparedArticle[]>({
    cacheKey,
    lockKey: `${cacheKey}:lock`,
    ttlSeconds: TOPIC_TTL_SECONDS,
    work: async () => {
      didWork = true;
      const gathered = await gatherViaSearchApi(topicName);
      freshQueries = gathered.queries;
      freshProvider = gathered.provider;
      return gathered.articles;
    },
  });

  if (didWork && articles.length === 0) {
    await setCached(cacheKey, articles, EMPTY_TTL_SECONDS);
  }

  if (!didWork) {
    console.log(`📦 [Search-API] Cache hit for "${topicName}"`);
    return toArticleSet(articles, [topicName], 'search-api-cached');
  }
  return toArticleSet(articles, freshQueries, `search-api-${freshProvider}`);
}
