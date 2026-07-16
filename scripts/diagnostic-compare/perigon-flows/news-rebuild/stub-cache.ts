// In-memory stub replacing Upstash Redis for the diagnostic script.
// Implements the same interface as src/lib/news/cache.ts.

const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  return work();
}
