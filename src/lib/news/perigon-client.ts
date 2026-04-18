// Thin HTTP wrapper for the Perigon endpoints we use.
// No caching, no business logic, no retries beyond the timeout.
// Caching, dedup, fallbacks live in fetch-orchestrator.ts.
//
// Defined locally (not imported from src/lib/perigon.ts) so the new news/
// module is self-contained and can be evolved independently of the legacy
// pipeline.

const PERIGON_BASE = 'https://api.perigon.io/v1';
const TIMEOUT_MS = 12_000;

// ─── Shared types ────────────────────────────────────────────────────

export interface PerigonSource {
  domain: string;
  name?: string;
  location?: { country?: string; city?: string };
}

export interface PerigonArticle {
  title: string;
  url: string;
  source: PerigonSource;
  pubDate: string;
  summary?: string;
  description?: string;
  content?: string;
  imageUrl?: string;
  topics?: { name: string }[];
  categories?: { name: string }[];
  labels?: { name: string }[];
  clusterId?: string;
}

export interface ArticlesResponse {
  status: number;
  numResults: number;
  articles: PerigonArticle[];
}

export interface PerigonStory {
  id: string;
  name: string;
  summary?: string;
  shortSummary?: string;
  slug?: string;
  uniqueSources?: string[];
  uniqueCount?: number;
  totalCount?: number;
  reprintCount?: number;
  selectedArticles?: PerigonArticle[];
  updatedAt: string;
  createdAt: string;
  imageUrl?: string;
  topCategories?: { name: string }[];
  topTopics?: { name: string }[];
  topPeople?: { name: string }[];
  topCompanies?: { name: string }[];
}

export interface StoriesResponse {
  status: number;
  numResults: number;
  results: PerigonStory[];
}

interface VectorRawResponse {
  status: number;
  results: { score: number; data: PerigonArticle }[];
}

/** Vector results normalized to the same shape as articles, with score retained. */
export interface VectorResponse {
  status: number;
  numResults: number;
  articles: (PerigonArticle & { score: number })[];
}

// ─── Param shapes ────────────────────────────────────────────────────

export interface ArticlesSearchParams {
  q?: string;
  sortBy?: 'date' | 'relevance' | 'updatedAt';
  size?: number;
  from?: string;
  to?: string;
  sourceGroup?: string[];
  source?: string[];
  excludeLabel?: string[];
  showReprints?: boolean;
  category?: string[];
  topic?: string[];
  language?: string[];
  country?: string[];
  medium?: string[];
  companyName?: string;
  clusterId?: string[];
}

export interface StoriesSearchParams {
  q?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'date';
  size?: number;
  from?: string;
  to?: string;
  sourceGroup?: string[];
  language?: string[];
  category?: string[];
  topic?: string[];
  minUniqueSources?: number;
}

export interface VectorSearchParams {
  prompt: string;
  size?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.PERIGON_API_KEY;
  if (!key) throw new Error('PERIGON_API_KEY is not configured');
  return key;
}

function abortAfter(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function appendArray(params: URLSearchParams, key: string, values?: string[]) {
  if (!values) return;
  for (const v of values) params.append(key, v);
}

// ─── Endpoints ───────────────────────────────────────────────────────

/** GET /v1/articles/all */
export async function fetchArticles(opts: ArticlesSearchParams): Promise<ArticlesResponse> {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  if (opts.q) params.set('q', opts.q);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.size !== undefined) params.set('size', String(opts.size));
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.showReprints !== undefined) params.set('showReprints', String(opts.showReprints));
  if (opts.companyName) params.set('companyName', opts.companyName);
  appendArray(params, 'sourceGroup', opts.sourceGroup);
  appendArray(params, 'source', opts.source);
  appendArray(params, 'excludeLabel', opts.excludeLabel);
  appendArray(params, 'category', opts.category);
  appendArray(params, 'topic', opts.topic);
  appendArray(params, 'language', opts.language);
  appendArray(params, 'country', opts.country);
  appendArray(params, 'medium', opts.medium);
  appendArray(params, 'clusterId', opts.clusterId);

  const url = `${PERIGON_BASE}/articles/all?${params}`;
  const res = await fetch(url, { signal: abortAfter(TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perigon /articles/all failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<ArticlesResponse>;
}

/** GET /v1/stories/all */
export async function fetchStories(opts: StoriesSearchParams): Promise<StoriesResponse> {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  if (opts.q) params.set('q', opts.q);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  if (opts.size !== undefined) params.set('size', String(opts.size));
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.minUniqueSources !== undefined) {
    params.set('minUniqueSources', String(opts.minUniqueSources));
  }
  appendArray(params, 'sourceGroup', opts.sourceGroup);
  appendArray(params, 'category', opts.category);
  appendArray(params, 'topic', opts.topic);
  appendArray(params, 'language', opts.language);

  const url = `${PERIGON_BASE}/stories/all?${params}`;
  const res = await fetch(url, { signal: abortAfter(TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perigon /stories/all failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<StoriesResponse>;
}

/** POST /v1/vector/news/all — normalized into a flat shape with retained score. */
export async function fetchVector(opts: VectorSearchParams): Promise<VectorResponse> {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  const url = `${PERIGON_BASE}/vector/news/all?${params}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: opts.prompt, size: opts.size ?? 15 }),
    signal: abortAfter(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perigon /vector/news/all failed (${res.status}): ${body}`);
  }
  const raw = (await res.json()) as VectorRawResponse;
  return {
    status: raw.status,
    numResults: raw.results?.length ?? 0,
    articles: (raw.results || []).map((r) => ({ ...r.data, score: r.score })),
  };
}
