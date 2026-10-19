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
// Article body text fetched for kept articles. Snippets alone gave the writer
// nothing but the headline to restate (every Oct 19 reviewer: "bullets too
// thin, lost the specifics"). ~1.5k chars × 12 articles ≈ 5k tokens/topic.
const BODY_MAX_CHARS = 1500;
const BODY_FETCH_TIMEOUT_MS = 5000;
const MAX_PER_HOST = 3;
// Below this many relevant articles the topic is treated as niche and Exa
// is consulted too. Brave gave 3 for "speedcubing", 10 for mainstream topics.
const SPARSE_THRESHOLD = 5;
const EXA_LOOKBACK_DAYS = 14;
// Reference sites and content-farm aggregators seen leading briefings in the
// Oct 2026 live runs. ponytail: a hand list; grow it from logs, swap for a
// source-quality score if it passes ~30 entries.
const BLOCKED_HOSTS = [
  // reference
  'wikipedia.org', 'wikimedia.org',
  // press-release wires and PR farms (the Oct 19 persona reviews flagged every one of these)
  'globenewswire.com', 'prnewswire.com', 'businesswire.com', 'openpr.com', 'marketmediawire.com',
  'streetinsider.com', 'einpresswire.com', 'accesswire.com', 'newsfilecorp.com',
  // content farms / aggregators / low-trust blogs seen leading briefings
  'archyde.com', 'europesays.com', 'view.edu.pl', 'tech-insider.org', 'bioengineer.org',
  'globalsouthopportunities.com', 'techtimes.com', 'coinpaper.com', 'blockchainreporter.net',
  'asumetech.com', 'tradersunion.com', 'devdiscourse.com',
  // betting picks dressed as news
  'sportsline.com',
];
const FRESH_WINDOW_MS = 48 * 3_600_000;

export interface ArticleSet {
  articles: PreparedArticle[];
  /** Planner judged this a markets/economy topic → attach the market snapshot line. */
  market?: boolean;
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
- For niche topics (hobbies, industry subfields), add the community's proper names (federations, flagship sites, jargon) — the places real news for that community breaks, not retailers or review sites.
- Include the current year in at most one query.

Also return:
- "niche": true when the news for this topic breaks on community/specialist sites (hobbies, fandoms, sub-fields of science or engineering, local news) rather than in mainstream outlets.
- "market": true when the topic is about financial markets, investing, the economy, crypto, or central banks (a market-levels line will be attached).
- "resultQuery": REQUIRED (not null) for any sport, league, motorsport, tournament, earnings season or central bank: a short query for the MOST RECENT completed event's result, naming the event if you know it ("Singapore Grand Prix 2026 race result", "NBA opening night scores", "FOMC decision") — it is searched with a wider date window so the briefing can lead with what just happened even if it was over a week ago. null only for topics with no recurring events.
- "communitySites": up to 4 hostnames where this community's own news breaks (e.g. "geekhack.org", "kbd.news" for keyboards; "arxiv.org", "huggingface.co" for ML research; "worldcubeassociation.org" for cubing). Empty for mainstream topics.

Respond with ONLY valid JSON: {"queries": ["...", "..."], "niche": false, "market": false, "resultQuery": null, "communitySites": []}`;
}

export interface QueryPlan {
  queries: string[];
  niche: boolean;
  market: boolean;
  resultQuery: string | null;
  communitySites: string[];
}

export function parsePlannedQueries(text: string, topicName: string): QueryPlan {
  const parsed = extractJson(text) as { queries?: unknown; niche?: unknown; market?: unknown; resultQuery?: unknown; communitySites?: unknown } | null;
  const strings = (v: unknown, max: number) =>
    Array.isArray(v) ? v.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).map(q => q.trim()).slice(0, max) : [];
  const plan: QueryPlan = {
    queries: strings(parsed?.queries, MAX_QUERIES),
    niche: parsed?.niche === true,
    market: parsed?.market === true,
    resultQuery: typeof parsed?.resultQuery === 'string' && parsed.resultQuery.trim() ? parsed.resultQuery.trim() : null,
    communitySites: strings(parsed?.communitySites, 4).map(h => h.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')),
  };
  if (plan.queries.length === 0) plan.queries = [topicName];
  return plan;
}

async function planQueries(topicName: string): Promise<QueryPlan> {
  try {
    return parsePlannedQueries(await nanoJson(buildPlannerPrompt(), `Topic: ${topicName}`), topicName);
  } catch (err) {
    console.warn(`⚠️ [Gather] Query planning failed for "${topicName}", using topic as query:`, err);
    return { queries: [topicName], niche: false, market: false, resultQuery: null, communitySites: [] };
  }
}

// ─── Relevance gate ──────────────────────────────────────────────────
// Search APIs keyword-match: Brave returned FIFA articles for "speedcubing";
// Exa returns Finnish classifieds for "mechanical keyboards". One tiny call
// over titles only (~300 tokens) drops the obvious junk. Fails open.

export function buildRelevancePrompt(topicName: string, communitySites: string[] = []): string {
  const communityNote = communitySites.length
    ? `\nItems from this topic's own community sites (${communitySites.join(', ')}) are the most valuable kind of result: keep them unless clearly off-topic, even when the headline is terse or jargon (a board name, a switch name, a build log).\n`
    : '';
  return `You are filtering news search results for an English-language briefing about: "${topicName}".
${communityNote}

You will get a numbered list of headlines with their site. Reply with the numbers to KEEP.
Keep anything plausibly ON-TOPIC — when unsure about relevance, keep it.
But DROP (even if on-topic) anything that is clearly one of:
- about an unrelated subject that merely matched keywords
- not in English
- a product listing, classified ad, coupon, deal, price-tracking, product-reservation or crowdfunding page
- a press release, market-research report ("market to reach $X billion"), vendor/store blog, or sponsored content
- a listicle or buying guide ("best X", "N picks", "explained", "what to know"), a generic evergreen explainer, or a site section/hub page
- a betting pick, odds, or prediction-model article
- a product review, hands-on, or spec rundown (a product LAUNCH is news; a review is not)
- a data dashboard, statistics landing page, or agency reference page (not a dated news item)
- a job, internship, or event-registration listing
- an opinion column with no new facts

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

async function filterRelevant(topicName: string, articles: PreparedArticle[], communitySites: string[] = []): Promise<PreparedArticle[]> {
  if (articles.length === 0) return articles;
  try {
    const list = articles.map((a, i) => `${i + 1}. ${a.title} (${a.source})`).join('\n');
    const kept = parseKeepIndices(await nanoJson(buildRelevancePrompt(topicName, communitySites), list), articles.length);
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

// The nano gate occasionally keeps a non-English page whose snippet it only
// skimmed (a Portuguese keyboard site shipped in the Oct 19 review). Cheap
// check: English text of any length has function words.
const EN_FUNCTION_WORDS = /\b(the|of|and|to|in|a|for|with|on|that|is|as|at|by|from|it|its|are|was|has|have)\b/gi;
export function looksEnglish(text: string): boolean {
  const words = text.trim().split(/\s+/).length;
  if (words < 8) return true; // too short to judge
  const hits = (text.match(EN_FUNCTION_WORDS) || []).length;
  return hits / words >= 0.08;
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
    // Syndicated wire copy on local-TV domains ("… | PR Newswire" on wfmz.com).
    if (/\b(PR Newswire|GlobeNewswire|Business Wire|ACCESSWIRE|EIN Presswire)\b/i.test(r.title)) continue;

    // A date in the URL path is the publish date; Brave's page_age can be a
    // later crawl/update (review: label "Oct 19" on a URL ending 10/16).
    const urlDate = pathname.match(/\/(20\d\d)[/-](\d{1,2})[/-](\d{1,2})(?:[/-]|$)/);
    const date = normalizeDate(urlDate ? `${urlDate[1]}-${urlDate[2].padStart(2, '0')}-${urlDate[3].padStart(2, '0')}T12:00:00Z` : r.date);
    if (isTooOld(date)) continue;
    if (!looksEnglish(`${r.title} ${r.snippet || ''}`)) continue;

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
  // Recency first: items from the last 48h keep their relevance order and go
  // ahead of older ones, so the assembler's "lead with the newest important
  // story" has the newest at the top. Unknown dates sort as old.
  const isFresh = (a: PreparedArticle) => {
    const t = Date.parse(a.date);
    return !Number.isNaN(t) && Date.now() - t <= FRESH_WINDOW_MS;
  };
  // Live blogs last within each bucket: their extracted text is whatever post
  // was on top at crawl time, which produced an off-headline lead in review.
  const isLive = (a: PreparedArticle) => /\/live[-_/]|live-updates|liveblog/i.test(a.url);
  const order = (list: PreparedArticle[]) => [...list.filter(a => !isLive(a)), ...list.filter(isLive)];
  return [...order(out.filter(isFresh)), ...order(out.filter(a => !isFresh(a)))];
}

// ─── Article body enrichment ─────────────────────────────────────────

/** Crude but dependency-free: paragraph text from HTML, scripts/styles removed. */
export function extractBodyText(html: string, max = BODY_MAX_CHARS): string {
  const noScript = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ');
  const paras = [...noScript.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 60); // skip nav crumbs, captions, cookie banners
  let out = '';
  for (const p of paras) {
    if (out.length + p.length > max) break;
    out += (out ? ' ' : '') + p;
  }
  return out;
}

async function fetchBody(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(BODY_FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BriefingBot/1.0; +https://briefing-five.vercel.app)', Accept: 'text/html' },
      redirect: 'follow',
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return '';
    // Read at most ~200KB; article text is near the top of the document.
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 200_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => undefined);
    return extractBodyText(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return ''; // paywalls, bot walls, timeouts: the snippet still stands
  }
}

/** Replace snippets with article text where a page can be fetched. Parallel, fail-soft. */
const ENRICH_BUDGET_MS = 8000;
async function enrichWithBodies(articles: PreparedArticle[]): Promise<PreparedArticle[]> {
  // Hard budget for the whole step: a slow-streaming page must never hold a
  // briefing hostage (one did in the Oct 19 round-5 run). Unfinished fetches
  // simply keep their snippet.
  const settled: string[] = articles.map(() => '');
  await Promise.race([
    Promise.all(articles.map(async (a, i) => { settled[i] = await fetchBody(a.url); })),
    new Promise<void>(r => setTimeout(r, ENRICH_BUDGET_MS)),
  ]);
  const bodies = settled;
  let hits = 0;
  const out = articles.map((a, i) => {
    if (bodies[i].length > a.summary.length) {
      hits++;
      return { ...a, summary: bodies[i] };
    }
    return a;
  });
  console.log(`📄 [Gather] Article text fetched for ${hits}/${articles.length}`);
  return out;
}

// ─── Providers ───────────────────────────────────────────────────────

async function searchBrave(query: string, freshness: 'pd' | 'pw' | 'pm' = 'pw'): Promise<RawSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(RESULTS_PER_QUERY),
    freshness,
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
    // page_age is the absolute publish timestamp; `age` is relative and was
    // producing "today" for week-old pieces in the Oct 19 reviews.
    date: r.page_age ?? r.age,
    snippet: [r.description, r.extra_snippets?.join(' ')].filter(Boolean).join(' '),
  }));
}

async function searchExa(query: string, includeDomains?: string[]): Promise<RawSearchResult[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': process.env.EXA_API_KEY!, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      query,
      type: 'auto',
      // Community sites (geekhack, arXiv, WCA) aren't "news" in Exa's
      // taxonomy; drop the category when targeting them explicitly.
      ...(includeDomains?.length ? { includeDomains } : { category: 'news' }),
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

async function braveAll(queries: { q: string; freshness?: 'pd' | 'pw' | 'pm' }[]): Promise<RawSearchResult[]> {
  const raw: RawSearchResult[] = [];
  for (const { q, freshness } of queries) {
    try {
      raw.push(...(await throttledBrave(() => searchBrave(q, freshness))));
    } catch (err) {
      if (String(err).includes('429')) {
        await sleep(1200);
        try {
          raw.push(...(await throttledBrave(() => searchBrave(q, freshness))));
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
  const settled = await Promise.allSettled(queries.map(q => searchExa(q)));
  const raw: RawSearchResult[] = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') raw.push(...s.value);
    else console.warn(`⚠️ [Gather] Exa query failed ("${queries[i]}"):`, s.reason);
  });
  return raw;
}

// ─── Main gather ─────────────────────────────────────────────────────

async function gather(topicName: string): Promise<{ articles: PreparedArticle[]; queries: string[]; provider: string; market: boolean }> {
  const hasBrave = !!process.env.BRAVE_API_KEY;
  const hasExa = !!process.env.EXA_API_KEY;
  if (!hasBrave && !hasExa) throw new Error('Gathering requires BRAVE_API_KEY and/or EXA_API_KEY');

  const plan = await planQueries(topicName);
  const { niche, market, resultQuery, communitySites } = plan;
  // The latest race/game/decision may be older than Brave's 7-day window
  // (hobby review: "F1 never says who won Singapore") — widen it for that one query.
  const braveQueries = [
    ...plan.queries.map(q => ({ q })),
    ...(resultQuery ? [{ q: resultQuery, freshness: 'pm' as const }] : []),
  ];
  const queries = braveQueries.map(b => b.q);
  let provider = '';
  let articles: PreparedArticle[] = [];

  if (hasBrave) {
    provider = 'brave';
    articles = await filterRelevant(topicName, prepareSearchResults(await braveAll(braveQueries)));
  }

  // Niche backstop: Exa's neural index carries the community sites a news
  // index misses (geekhack, WCA, speedsolving.com…). It runs when Brave is
  // thin OR the planner flagged the topic as niche — the Oct 19 hobby review
  // got 5 Brave product-PR items for "mechanical keyboards" and zero community
  // news. Brave results stay first so mainstream coverage leads.
  if (hasExa && (niche || articles.length < SPARSE_THRESHOLD)) {
    const exaRaw = await exaAll(plan.queries.slice(0, 2));
    // Planner-named community sites get one targeted query of their own, and
    // their hits go FIRST in the merged list: with Brave's 10–12 product-PR
    // items ahead of them they were falling off the 12-article cap (round 8
    // keyboards review: "NO community-site sources" although Exa had kbd.news).
    let communityRaw: RawSearchResult[] = [];
    if (communitySites.length > 0) {
      try {
        communityRaw = await searchExa(plan.queries[0], communitySites);
        console.log(`🏘️ [Gather] ${communityRaw.length} community-site results (${communitySites.join(', ')}) for "${topicName}"`);
      } catch (err) {
        console.warn(`⚠️ [Gather] Community-site query failed for "${topicName}":`, err);
      }
    }
    const exaArticles = await filterRelevant(topicName, prepareSearchResults([...communityRaw, ...exaRaw]), communitySites);
    if (exaArticles.length > 0) {
      provider = provider ? `${provider}+exa` : 'exa';
      const communityHosts = new Set(communitySites);
      const fromCommunity = exaArticles.filter(a => communityHosts.has(hostOf(a.url)));
      const rest = exaArticles.filter(a => !communityHosts.has(hostOf(a.url)));
      articles = prepareSearchResults([...fromCommunity, ...articles, ...rest].map(a => ({ ...a, snippet: a.summary })), MAX_ARTICLES + 4);
    }
  }

  console.log(`🔎 [Gather] ${provider || 'none'}: ${queries.length} queries → ${articles.length} articles for "${topicName}"${market ? ' [market]' : ''}`);
  return { articles: await enrichWithBodies(articles), queries, provider, market };
}

/**
 * Gather recent articles for a topic. Cached and single-flighted per
 * canonical topic (6h) so overlapping users and the cron share one gather.
 */
export async function gatherArticles(topicName: string, skipCache = false): Promise<ArticleSet> {
  const cacheKey = `gather:${canonicalTopicId(topicName)}`;
  type Cached = { articles: PreparedArticle[]; market: boolean };
  const toSet = (c: Cached, queries: string[], cascadeStep: string): ArticleSet => ({
    articles: c.articles,
    market: c.market,
    debugInfo: { queries: queries.map(q => ({ type: 'search', query: q })), articleCount: c.articles.length, cascadeStep },
  });

  if (skipCache) {
    const g = await gather(topicName);
    return toSet({ articles: g.articles, market: g.market }, g.queries, g.provider);
  }

  let fresh: { queries: string[]; provider: string } | null = null;
  const cached = await fetchWithLock<Cached>({
    cacheKey,
    lockKey: `${cacheKey}:lock`,
    ttlSeconds: TOPIC_TTL_SECONDS,
    work: async () => {
      const g = await gather(topicName);
      fresh = { queries: g.queries, provider: g.provider };
      return { articles: g.articles, market: g.market };
    },
  });
  // Entries written before the market flag existed are plain arrays.
  const entry: Cached = Array.isArray(cached) ? { articles: cached as PreparedArticle[], market: false } : cached;

  if (fresh) {
    const f = fresh as { queries: string[]; provider: string };
    if (entry.articles.length === 0) await setCached(cacheKey, entry, EMPTY_TTL_SECONDS);
    return toSet(entry, f.queries, f.provider);
  }
  console.log(`📦 [Gather] Cache hit for "${topicName}"`);
  return toSet(entry, [topicName], 'cached');
}
