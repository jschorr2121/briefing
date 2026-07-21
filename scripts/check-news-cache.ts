// Offline checks for the news cache: canonical topic keys and the
// single-flight lock, including the load-bearing guarantee that two
// CONCURRENT identical requests produce exactly ONE gather call.
// No network, no keys. Run with: npx tsx scripts/check-news-cache.ts

import type { Redis } from '@upstash/redis';
import { canonicalTopicId, fetchWithLock, _setRedisForTests } from '../src/lib/news/cache';

let failures = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}`);
    failures++;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Fake Redis (in-memory, TTL- and NX-aware) ───────────────────────

function makeFakeRedis() {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();
  const alive = (k: string) => {
    const e = store.get(k);
    if (!e) return false;
    if (e.expiresAt !== null && Date.now() > e.expiresAt) {
      store.delete(k);
      return false;
    }
    return true;
  };
  return {
    async get(key: string) {
      return alive(key) ? store.get(key)!.value : null;
    },
    async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) {
      if (opts?.nx && alive(key)) return null;
      store.set(key, { value, expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null });
      return 'OK';
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
  } as unknown as Redis;
}

// ─── canonicalTopicId ────────────────────────────────────────────────

check('identity: simple slug', canonicalTopicId('World News') === 'world');
check('equivalent: "AI news" ≡ "artificial intelligence"',
  canonicalTopicId('AI news') === canonicalTopicId('artificial intelligence'));
check('equivalent: punctuation/case ignored',
  canonicalTopicId('A.I.') === canonicalTopicId('ai'));
check('equivalent: filler words stripped',
  canonicalTopicId('latest crypto updates') === canonicalTopicId('Cryptocurrency'));
check('equivalent: F1 aliases',
  canonicalTopicId('F1') === canonicalTopicId('Formula One') &&
  canonicalTopicId('F1') === canonicalTopicId('formula 1 news'));
check('distinct topics stay distinct',
  canonicalTopicId('machine learning') !== canonicalTopicId('ai'));
check('all-filler topic falls back to full slug', canonicalTopicId('News') === 'news');

// ─── fetchWithLock coalescing ────────────────────────────────────────

async function testConcurrentSameProcess() {
  _setRedisForTests(makeFakeRedis());
  let workCalls = 0;
  const work = async () => {
    workCalls++;
    await sleep(200);
    return { articles: ['a1'] };
  };
  const opts = { cacheKey: 'test:topic:ai', lockKey: 'test:topic:ai:lock', ttlSeconds: 60, work };

  const [r1, r2] = await Promise.all([fetchWithLock(opts), fetchWithLock(opts)]);
  check('in-process: two concurrent identical requests → ONE gather', workCalls === 1);
  check('in-process: both callers get the same result',
    JSON.stringify(r1) === JSON.stringify(r2) && r1.articles[0] === 'a1');
}

async function testConcurrentCrossProcess() {
  // Shared fake Redis, but bypass the in-process promise map — this is two
  // serverless instances hitting the same topic at the same time.
  _setRedisForTests(makeFakeRedis());
  let workCalls = 0;
  const mkOpts = (tag: string) => ({
    cacheKey: 'test:topic:finance',
    lockKey: 'test:topic:finance:lock',
    ttlSeconds: 60,
    pollMs: 25,
    maxWaitMs: 5_000,
    _bypassProcessDedup: true,
    work: async () => {
      workCalls++;
      await sleep(300); // a slow gather
      return { articles: [`gathered-by-${tag}`] };
    },
  });

  const winner = fetchWithLock(mkOpts('first'));
  await sleep(50); // second request arrives while the first is mid-gather
  const loser = fetchWithLock(mkOpts('second'));
  const [r1, r2] = await Promise.all([winner, loser]);

  check('cross-instance: two concurrent identical requests → ONE gather', workCalls === 1);
  check('cross-instance: second caller awaits and receives the first result',
    r1.articles[0] === 'gathered-by-first' && r2.articles[0] === 'gathered-by-first');
}

async function testLoserTakesOverOnWinnerCrash() {
  _setRedisForTests(makeFakeRedis());
  let secondWorkRan = false;
  const base = {
    cacheKey: 'test:topic:crash',
    lockKey: 'test:topic:crash:lock',
    ttlSeconds: 60,
    pollMs: 25,
    maxWaitMs: 5_000,
    _bypassProcessDedup: true,
  };

  const winner = fetchWithLock({
    ...base,
    work: async () => {
      await sleep(150);
      throw new Error('gather exploded');
    },
  }).catch(() => 'winner-failed');

  await sleep(50);
  const loser = fetchWithLock({
    ...base,
    work: async () => {
      secondWorkRan = true;
      return { articles: ['recovered'] };
    },
  });

  const [w, l] = await Promise.all([winner, loser]);
  check('crash recovery: winner error propagates to winner only', w === 'winner-failed');
  check('crash recovery: waiter takes over the lock and gathers',
    secondWorkRan && (l as { articles: string[] }).articles[0] === 'recovered');
}

async function testDistinctKeysDontBlock() {
  _setRedisForTests(makeFakeRedis());
  let calls = 0;
  const mk = (key: string) => ({
    cacheKey: `test:topic:${key}`,
    lockKey: `test:topic:${key}:lock`,
    ttlSeconds: 60,
    _bypassProcessDedup: true,
    work: async () => {
      calls++;
      return key;
    },
  });
  const [a, b] = await Promise.all([fetchWithLock(mk('alpha')), fetchWithLock(mk('beta'))]);
  check('distinct topics gather independently', calls === 2 && a === 'alpha' && b === 'beta');
}

async function testCacheHitSkipsWork() {
  _setRedisForTests(makeFakeRedis());
  let calls = 0;
  const opts = {
    cacheKey: 'test:topic:cachehit',
    lockKey: 'test:topic:cachehit:lock',
    ttlSeconds: 60,
    _bypassProcessDedup: true,
    work: async () => {
      calls++;
      return 'fresh';
    },
  };
  await fetchWithLock(opts);
  const second = await fetchWithLock(opts);
  check('sequential second request is a pure cache read', calls === 1 && second === 'fresh');
}

(async () => {
  await testConcurrentSameProcess();
  await testConcurrentCrossProcess();
  await testLoserTakesOverOnWinnerCrash();
  await testDistinctKeysDontBlock();
  await testCacheHitSkipsWork();
  _setRedisForTests(undefined);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
})();
