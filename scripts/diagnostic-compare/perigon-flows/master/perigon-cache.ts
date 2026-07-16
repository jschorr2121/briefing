// In-memory stub replacing Upstash Redis for master branch perigon-cache.ts

export interface PerigonArticle {
  title: string;
  url: string;
  source: { domain: string; name?: string };
  pubDate: string;
  summary?: string;
  description?: string;
}

export interface PerigonArticlesResponse {
  status: number;
  numResults: number;
  articles: PerigonArticle[];
}

export type PerigonResult = { data: PerigonArticlesResponse };

const queryCache = new Map<string, { result: PerigonResult; expiresAt: number }>();

function queryKey(type: string, query: string): string {
  return `q:${type}:${query.toLowerCase().trim()}`;
}

export async function getCachedQueryArticles(
  type: string,
  query: string
): Promise<PerigonResult | null> {
  const key = queryKey(type, query);
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  return entry.result;
}

export async function setCachedQueryArticles(
  type: string,
  query: string,
  result: PerigonResult
): Promise<void> {
  const key = queryKey(type, query);
  queryCache.set(key, { result, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
}
