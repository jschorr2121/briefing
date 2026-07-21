// LIVE companion to check-news-cache.ts: proves single-flight coalescing
// against the real Upstash Redis (the fake-Redis checks prove the logic;
// this proves the deployed backend honors it — SET NX semantics, TTLs).
//
//   npx tsx scripts/check-news-cache-live.ts
//
// Requires KV_REST_API_URL / KV_REST_API_TOKEN. Uses throwaway keys under
// "test:coalesce:*" and deletes them afterwards; never touches production
// cache entries. Skips (exit 0) when creds are absent so CI without secrets
// stays green.

import { fetchWithLock, getRedis } from '../src/lib/news/cache';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failures++;
  }
}

async function main() {
  const redis = getRedis();
  if (!redis) {
    console.log('⏭️  KV_REST_API_URL/TOKEN not set — live Redis check skipped');
    return;
  }

  const runId = `${Date.now()}-${process.pid}`;
  const cacheKey = `test:coalesce:${runId}`;
  const lockKey = `${cacheKey}:lock`;

  try {
    // Two "instances" (in-process dedup bypassed) race for the same topic.
    // The winner's work takes 3s; the loser must await the winner's result
    // via Redis rather than gathering again.
    let gathers = 0;
    const work = async () => {
      gathers++;
      await new Promise(r => setTimeout(r, 3000));
      return { payload: `gathered-by-${runId}` };
    };

    const t0 = Date.now();
    const [a, b] = await Promise.all([
      fetchWithLock({ cacheKey, lockKey, ttlSeconds: 60, work, _bypassProcessDedup: true }),
      fetchWithLock({ cacheKey, lockKey, ttlSeconds: 60, work, _bypassProcessDedup: true }),
    ]);
    const elapsed = Date.now() - t0;

    check('two concurrent identical requests → ONE gather (live Redis)', gathers === 1);
    check('both callers received the winner result', a.payload === b.payload && a.payload === `gathered-by-${runId}`);
    check('loser awaited instead of failing open (no double-gather latency)', elapsed < 8000);

    const ttl = await redis.ttl(cacheKey);
    check('result cached in Redis with requested TTL', ttl > 0 && ttl <= 60);

    const lockGone = await redis.get(lockKey);
    check('lock released after work completed', lockGone === null || lockGone === undefined);

    const third = await fetchWithLock({ cacheKey, lockKey, ttlSeconds: 60, work, _bypassProcessDedup: true });
    check('subsequent request is a pure cache read', gathers === 1 && third.payload === a.payload);
  } finally {
    // Best-effort cleanup — the keys also expire on their own TTLs.
    await Promise.allSettled([redis.del(cacheKey), redis.del(lockKey)]);
  }

  if (failures > 0) {
    console.error(`\n${failures} live check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll live Redis checks passed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
