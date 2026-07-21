// Caching primitives for the news pipeline.
//
// Three things in this file:
//   1. A typed Redis getter (Upstash) — same env vars as the rest of the app.
//   2. A typed get/set for the topic-level result cache.
//   3. A single-flight wrapper that combines an in-process Promise map with a
//      Redis SET-NX cross-process lock so a popular topic only fetches once
//      per cluster.

import { Redis } from '@upstash/redis';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Redis timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Redis ───────────────────────────────────────────────────────────

let _redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    _redis = null;
    return _redis;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Test seam: inject a fake Redis client (scripts/check-news-cache.ts) so the
 * lock/coalescing logic can be exercised without Upstash credentials.
 * Pass undefined to restore env-based resolution.
 */
export function _setRedisForTests(client: Redis | null | undefined): void {
  _redis = client;
}

// ─── Canonical topic keys ────────────────────────────────────────────
//
// Semantically-equivalent topics must share one cache entry, or the
// cross-user cache fragments ("AI news" / "artificial intelligence" /
// "Artificial Intelligence!" each paying for their own gather).
//
// Two cheap deterministic steps: strip filler words that don't change what
// a topic is about, then map known synonyms onto one canonical slug. An
// embedding-based match could catch more pairs but adds a model call to
// every cache lookup; the deterministic pass is free and never wrong in a
// surprising way.

const FILLER_WORDS = new Set([
  'news', 'latest', 'updates', 'update', 'daily', 'today', 'todays',
  'briefing', 'headlines', 'stories', 'the', 'about', 'on',
]);

// slug → canonical slug. Keep entries conservative: only pairs a user would
// agree name the same topic.
const TOPIC_ALIASES: Record<string, string> = {
  artificial_intelligence: 'ai',
  a_i: 'ai',
  ai_ml: 'ai',
  formula_one: 'formula_1',
  f1: 'formula_1',
  cryptocurrency: 'crypto',
  cryptocurrencies: 'crypto',
  bitcoin_crypto: 'crypto',
  us_stock_market: 'stock_market',
  stocks: 'stock_market',
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Canonical cache id for a topic name. "AI news", "artificial intelligence"
 * and "Artificial Intelligence!" all map to "ai".
 */
export function canonicalTopicId(topicName: string): string {
  const base = slugify(topicName);
  const meaningful = base.split('_').filter(w => w && !FILLER_WORDS.has(w));
  const stripped = meaningful.join('_') || base; // never strip to empty
  return TOPIC_ALIASES[stripped] ?? stripped;
}

// ─── Topic-level result cache ────────────────────────────────────────

/** Default TTL for topic results. 6 hours, uniform across all shapes. */
export const TOPIC_TTL_SECONDS = 6 * 60 * 60;

/** Shorter TTL for cached *empty* results so dead niche queries don't keep cascading. */
export const EMPTY_TTL_SECONDS = 30 * 60;

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const v = await withTimeout(redis.get<T>(key), 3000);
    return v ?? null;
  } catch (err) {
    console.error(`[news/cache] get failed for ${key}:`, err);
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withTimeout(redis.set(key, value, { ex: ttlSeconds }), 3000);
  } catch (err) {
    console.error(`[news/cache] set failed for ${key}:`, err);
  }
}

// ─── In-process single-flight ────────────────────────────────────────

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Run `work()` at most once concurrently per `key` *within this process*.
 * Concurrent callers await the same promise.
 */
export function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = work().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ─── Cross-process Redis lock ────────────────────────────────────────
//
// The lock must outlive the slowest work it guards or coalescing breaks:
// an agentic gather runs 10–30s, a search-API gather 2–10s. With the old
// 12s TTL / 6s max wait, a second concurrent caller gave up while the
// first was still gathering and fired its own gather — exactly the
// duplicate work the lock exists to prevent.

const LOCK_TTL_SECONDS = 90; // > worst-case gather, so the lock can't expire mid-work
const LOCK_POLL_MS = 500;
const LOCK_MAX_WAIT_MS = 60_000; // losers wait out a full slow gather before failing open

/**
 * Try to acquire a Redis lock. Returns true on success, false if another
 * process holds it. The caller is responsible for releasing.
 */
async function acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // no Redis → no cross-process coordination, just proceed
  try {
    // Upstash returns "OK" on success, null when nx fails. Coerce defensively.
    const result = await withTimeout(redis.set(lockKey, '1', { nx: true, ex: ttlSeconds }), 3000);
    return result !== null && result !== undefined;
  } catch (err) {
    console.error(`[news/cache] lock acquire failed for ${lockKey}:`, err);
    return true; // fail-open: better to occasionally double-fetch than to deadlock
  }
}

async function lockHeld(lockKey: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const v = await withTimeout(redis.get(lockKey), 3000);
    return v !== null && v !== undefined;
  } catch {
    return true; // assume held on error so we keep waiting instead of stampeding
  }
}

async function releaseLock(lockKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withTimeout(redis.del(lockKey), 3000);
  } catch (err) {
    console.error(`[news/cache] lock release failed for ${lockKey}:`, err);
  }
}

/**
 * Cross-process single-flight: combine the in-process map with a Redis lock,
 * and a cache-check loop for losers.
 *
 *   - First, check the cache.
 *   - If miss, try to acquire the Redis lock.
 *   - If we get the lock, run `work`, write to cache, release the lock.
 *   - If we don't get the lock, await the winner's result: poll the cache
 *     until it appears (up to maxWaitMs, sized to outlast a slow gather).
 *     If the lock vanishes without a result, take over the lock instead of
 *     stampeding. Only after the full wait do we fail open and run `work`.
 */
export async function fetchWithLock<T>(opts: {
  cacheKey: string;
  lockKey: string;
  ttlSeconds: number;
  work: () => Promise<T>;
  lockTtlSeconds?: number;
  maxWaitMs?: number;
  pollMs?: number;
  /** Test-only: skip the in-process promise map so two calls in one process exercise the Redis lock path. */
  _bypassProcessDedup?: boolean;
}): Promise<T> {
  const { cacheKey, lockKey, ttlSeconds, work } = opts;
  const lockTtl = opts.lockTtlSeconds ?? LOCK_TTL_SECONDS;
  const maxWaitMs = opts.maxWaitMs ?? LOCK_MAX_WAIT_MS;
  const pollMs = opts.pollMs ?? LOCK_POLL_MS;

  const runWork = async (): Promise<T> => {
    const result = await work();
    await setCached(cacheKey, result, ttlSeconds);
    return result;
  };

  const body = async (): Promise<T> => {
    // 1. Cache check.
    const cached = await getCached<T>(cacheKey);
    if (cached !== null) return cached;

    // 2. Try the Redis lock.
    if (await acquireLock(lockKey, lockTtl)) {
      try {
        return await runWork();
      } finally {
        await releaseLock(lockKey);
      }
    }

    // 3. Loser path — another process is gathering. Await its result: poll
    //    the cache until the winner publishes. If the lock disappears with
    //    no result (winner crashed or found nothing cacheable), try to take
    //    the lock ourselves rather than instantly stampeding.
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, pollMs));
      const v = await getCached<T>(cacheKey);
      if (v !== null) return v;
      if (!(await lockHeld(lockKey))) {
        if (await acquireLock(lockKey, lockTtl)) {
          try {
            // Re-check: the winner may have written between our polls.
            const late = await getCached<T>(cacheKey);
            return late !== null ? late : await runWork();
          } finally {
            await releaseLock(lockKey);
          }
        }
      }
    }

    // 4. Defensive fallthrough — waited out maxWaitMs with a held lock.
    //    Fail open: a duplicate gather beats returning nothing.
    return runWork();
  };

  return opts._bypassProcessDedup ? body() : singleFlight(cacheKey, body);
}
