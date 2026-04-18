// Caching primitives for the news pipeline.
//
// Three things in this file:
//   1. A typed Redis getter (Upstash) — same env vars as the rest of the app.
//   2. A typed get/set for the topic-level result cache.
//   3. A single-flight wrapper that combines an in-process Promise map with a
//      Redis SET-NX cross-process lock so a popular topic only fetches once
//      per cluster.

import { Redis } from '@upstash/redis';

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

// ─── Topic-level result cache ────────────────────────────────────────

/** Default TTL for topic results. 6 hours, uniform across all shapes. */
export const TOPIC_TTL_SECONDS = 6 * 60 * 60;

/** Shorter TTL for cached *empty* results so dead niche queries don't keep cascading. */
export const EMPTY_TTL_SECONDS = 30 * 60;

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const v = await redis.get<T>(key);
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
    await redis.set(key, value, { ex: ttlSeconds });
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

const LOCK_TTL_SECONDS = 12;
const LOCK_POLL_MS = 250;
const LOCK_MAX_WAIT_MS = 6_000;

/**
 * Try to acquire a Redis lock. Returns true on success, false if another
 * process holds it. The caller is responsible for releasing.
 */
async function acquireLock(lockKey: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // no Redis → no cross-process coordination, just proceed
  try {
    // Upstash returns "OK" on success, null when nx fails. Coerce defensively.
    const result = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL_SECONDS });
    return result !== null && result !== undefined;
  } catch (err) {
    console.error(`[news/cache] lock acquire failed for ${lockKey}:`, err);
    return true; // fail-open: better to occasionally double-fetch than to deadlock
  }
}

async function releaseLock(lockKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(lockKey);
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
 *   - If we don't get the lock, poll the cache for up to LOCK_MAX_WAIT_MS.
 *     If a result appears, return it. Otherwise fall through and run `work`
 *     ourselves (defensive — winner may have crashed).
 */
export async function fetchWithLock<T>(opts: {
  cacheKey: string;
  lockKey: string;
  ttlSeconds: number;
  work: () => Promise<T>;
}): Promise<T> {
  const { cacheKey, lockKey, ttlSeconds, work } = opts;

  return singleFlight(cacheKey, async () => {
    // 1. Cache check.
    const cached = await getCached<T>(cacheKey);
    if (cached !== null) return cached;

    // 2. Try the Redis lock.
    const gotLock = await acquireLock(lockKey);
    if (gotLock) {
      try {
        const result = await work();
        await setCached(cacheKey, result, ttlSeconds);
        return result;
      } finally {
        await releaseLock(lockKey);
      }
    }

    // 3. Loser path — poll the cache.
    const start = Date.now();
    while (Date.now() - start < LOCK_MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
      const v = await getCached<T>(cacheKey);
      if (v !== null) return v;
    }

    // 4. Defensive fallthrough — winner crashed or is slow. Just do the work.
    const result = await work();
    await setCached(cacheKey, result, ttlSeconds);
    return result;
  });
}
