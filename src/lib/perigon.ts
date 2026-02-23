// Perigon News API client
// Docs: https://docs.perigon.io

// ─── Response types ──────────────────────────────────────────────────

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
  sentiment?: { positive: number; negative: number; neutral: number };
}

export interface PerigonArticlesResponse {
  status: number;
  numResults: number;
  articles: PerigonArticle[];
}

// Vector search returns a different shape: results[].data contains the article
export interface PerigonVectorResult {
  score: number;
  data: PerigonArticle;
}

export interface PerigonVectorResponse {
  status: number;
  results: PerigonVectorResult[];
}

export interface PerigonSummarizerResponse {
  summary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const PERIGON_BASE = 'https://api.perigon.io/v1';
const TIMEOUT_MS = 10_000;

function getApiKey(): string {
  const key = process.env.PERIGON_API_KEY;
  if (!key) throw new Error('PERIGON_API_KEY is not configured');
  return key;
}

function createAbortSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), TIMEOUT_MS);
  return controller.signal;
}

/** Get a date string N days ago in YYYY-MM-DD format */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── Article Search (broad/popular topics) ───────────────────────────
// Uses GET /v1/all with the `topic` param (Perigon taxonomy tag)
// and optional `category` param for filtering.

export async function searchArticles(opts: {
  topic?: string;
  category?: string;
  q?: string;
  size?: number;
  sortBy?: string;
  from?: string;
}): Promise<PerigonArticlesResponse> {
  const params = new URLSearchParams({
    apiKey: getApiKey(),
    size: String(opts.size ?? 10),
    sortBy: opts.sortBy ?? 'date',
    from: opts.from ?? daysAgo(7),
  });
  if (opts.topic) params.set('topic', opts.topic);
  if (opts.category) params.set('category', opts.category);
  if (opts.q) params.set('q', opts.q);

  const url = `${PERIGON_BASE}/all?${params}`;
  const res = await fetch(url, { signal: createAbortSignal() });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perigon article search failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<PerigonArticlesResponse>;
}

// ─── Vector Article Search (niche topics — semantic search) ──────────
// Uses POST /v1/vector/news/all for semantic/concept search.
// Returns results ranked by cosine similarity score.

export async function vectorSearchArticles(opts: {
  prompt: string;
  size?: number;
}): Promise<PerigonArticlesResponse> {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  const url = `${PERIGON_BASE}/vector/news/all?${params}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: opts.prompt,
      size: opts.size ?? 10,
    }),
    signal: createAbortSignal(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perigon vector search failed (${res.status}): ${body}`);
  }

  // Normalize vector response shape into PerigonArticlesResponse
  const raw = await res.json() as PerigonVectorResponse;
  return {
    status: raw.status,
    numResults: raw.results?.length ?? 0,
    articles: (raw.results || []).map(r => r.data),
  };
}

// ─── Search Summarizer ───────────────────────────────────────────────
// Uses POST /v1/summarize. May not be available on all API tiers.

export async function searchSummarizer(opts: {
  prompt: string;
  q?: string;
  size?: number;
}): Promise<PerigonSummarizerResponse> {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  if (opts.q) params.set('q', opts.q);
  if (opts.size) params.set('size', String(opts.size));

  const url = `${PERIGON_BASE}/summarize?${params}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: opts.prompt }),
    signal: createAbortSignal(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Perigon summarizer failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<PerigonSummarizerResponse>;
}
