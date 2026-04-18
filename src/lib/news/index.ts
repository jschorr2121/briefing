// Public entry point for the news pipeline.
//
//   getNewsForTopic("AI") → { topic, cards, summary, fromCache, usedFallback }
//
// Owns the topic-level cache. Two slightly different QueryPlans for "AI" hit
// the same cache entry because the key is `news:v1:{hash(normalizeTopic())}`.
//
// Briefing assembly is just:
//   for (const topic of user.topics) {
//     const result = await getNewsForTopic(topic);
//     // render result.summary above result.cards
//   }

import { fetchForPlan } from './fetch-orchestrator';
import { fetchWithLock, setCached, EMPTY_TTL_SECONDS, TOPIC_TTL_SECONDS } from './cache';
import { normalizeTopic, topicCacheKey, topicLockKey } from './normalize';
import { getQueryPlan } from './query-planner';
import type { NewsCard } from './rank';
import { generateTopicSummary } from './topic-summary';
import { logHeader, log, logJson, logSeparator } from './logger';

export type { NewsCard } from './rank';
export type { QueryPlan, QueryShape } from './query-planner';

export interface TopicResult {
  /** The original raw topic the user typed. */
  topic: string;
  /** Normalized form, useful for debugging / cache inspection. */
  normalizedTopic: string;
  /** Final ranked cards (max 6). */
  cards: NewsCard[];
  /** Markdown bulleted summary, one bullet per card (or merged). */
  summary: string;
  /** True if the taxonomy fallback fired (sparse niche query). */
  usedFallback: boolean;
  /** True if served from cache rather than freshly fetched. */
  fromCache: boolean;
  /** Number of Perigon HTTP calls made on this invocation (0 on cache hit). */
  perigonCalls: number;
  /** ISO timestamp of when this result was produced. */
  generatedAt: string;
}

interface CachedTopicPayload {
  topic: string;
  normalizedTopic: string;
  cards: NewsCard[];
  summary: string;
  usedFallback: boolean;
  generatedAt: string;
}

/**
 * Main entry point. Returns ranked cards + bulleted summary for a topic,
 * served from a 6h Redis cache when available.
 */
export interface GetNewsOptions {
  /** Skip all caching — always fetch fresh from Perigon + regenerate summary. */
  skipCache?: boolean;
}

export async function getNewsForTopic(rawTopic: string, opts?: GetNewsOptions): Promise<TopicResult> {
  const trimmed = (rawTopic || '').trim();
  if (!trimmed) {
    return {
      topic: rawTopic,
      normalizedTopic: '',
      cards: [],
      summary: '',
      usedFallback: false,
      fromCache: false,
      perigonCalls: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  const skipCache = opts?.skipCache === true;
  const normalized = normalizeTopic(trimmed);

  // When skipCache is set, bypass the topic-level cache entirely.
  if (skipCache) {
    logHeader(`getNewsForTopic("${trimmed}") — skipCache=true`);
    log('index', `Normalized: "${normalized}"`);

    const plan = await getQueryPlan(trimmed);
    const result = await fetchForPlan(plan);

    log('index', `Perigon calls: ${result.perigonCalls}, cards: ${result.cards.length}, usedFallback: ${result.usedFallback}`);

    let summary = '';
    if (result.cards.length > 0) {
      log('index', `Generating topic summary via OpenAI...`);
      summary = await generateTopicSummary({ topic: trimmed, cards: result.cards });
      log('index', `Summary generated (${summary.length} chars)`);
      logJson('index', 'Summary', summary);
    } else {
      log('index', 'No cards — skipping summary generation');
    }

    logSeparator();
    return {
      topic: trimmed,
      normalizedTopic: normalized,
      cards: result.cards,
      summary,
      usedFallback: result.usedFallback,
      fromCache: false,
      perigonCalls: result.perigonCalls,
      generatedAt: new Date().toISOString(),
    };
  }

  const cacheKey = topicCacheKey(trimmed);
  const lockKey = topicLockKey(trimmed);

  // We need to know whether the result came from the cache vs was freshly
  // fetched. fetchWithLock returns the same shape either way, so we tag
  // results with `fromCache: true` only when the work() callback never ran.
  let didWork = false;
  let perigonCalls = 0;

  const payload = await fetchWithLock<CachedTopicPayload>({
    cacheKey,
    lockKey,
    ttlSeconds: TOPIC_TTL_SECONDS,
    work: async () => {
      didWork = true;

      const plan = await getQueryPlan(trimmed);
      const result = await fetchForPlan(plan);
      perigonCalls = result.perigonCalls;

      // For empty results we still cache, but with a much shorter TTL so we
      // don't keep cascading. The wrapper TTL is 6h; we override below.
      const summary = result.cards.length > 0 ? await generateTopicSummary({ topic: trimmed, cards: result.cards }) : '';

      return {
        topic: trimmed,
        normalizedTopic: normalized,
        cards: result.cards,
        summary,
        usedFallback: result.usedFallback,
        generatedAt: new Date().toISOString(),
      };
    },
  });

  // If we just generated an empty result, shorten its TTL so dead niche
  // queries get a chance to come back to life on the next user request.
  if (didWork && payload.cards.length === 0) {
    await setCached(cacheKey, payload, EMPTY_TTL_SECONDS);
  }

  return {
    topic: payload.topic,
    normalizedTopic: payload.normalizedTopic,
    cards: payload.cards,
    summary: payload.summary,
    usedFallback: payload.usedFallback,
    fromCache: !didWork,
    perigonCalls,
    generatedAt: payload.generatedAt,
  };
}

/**
 * Pre-warm the topic cache. Same as `getNewsForTopic` but discards the
 * return value — used by the cron `generate-briefs` job to ensure
 * user-opened briefings are cache hits.
 */
export async function warmTopic(rawTopic: string): Promise<void> {
  try {
    await getNewsForTopic(rawTopic);
  } catch (err) {
    console.error(`[news] warmTopic failed for "${rawTopic}":`, err);
  }
}
