// Orchestrates a single Perigon fetch attempt for a query plan, including:
//   - executing the initial request set in parallel
//   - converting raw responses into NewsCards
//   - running the sparse-result cascade if too few cards came back
//
// This module does NOT touch the topic-level cache. The caller (index.ts)
// owns that, so a single getNewsForTopic call only writes to Redis once.

import { fetchArticles, fetchStories, fetchVector } from './perigon-client';
import type { ArticlesResponse, StoriesResponse, VectorResponse } from './perigon-client';
import type { PerigonRequest } from './routing';
import { buildRequests, nextFallback } from './routing';
import type { QueryPlan } from './query-planner';
import { articleToCard, dedupByUrl, rankCards, storyToCard } from './rank';
import type { NewsCard } from './rank';
import { log, logJson } from './logger';

const MIN_RESULTS_BEFORE_CASCADE = 5;
const MAX_CASCADE_STEPS = 4;

export interface OrchestratorResult {
  cards: NewsCard[];
  /** True if the taxonomy fallback fired and we're showing related coverage. */
  usedFallback: boolean;
  /** Number of Perigon HTTP calls made (for logging / quota tracking). */
  perigonCalls: number;
}

// ─── Per-request execution ───────────────────────────────────────────

function summarizeArticlesResponse(res: ArticlesResponse): object {
  return {
    numResults: res.numResults,
    returnedCount: res.articles?.length ?? 0,
    articles: (res.articles || []).slice(0, 6).map(a => ({
      title: a.title,
      source: a.source?.domain,
      pubDate: a.pubDate,
      url: a.url,
    })),
  };
}

function summarizeStoriesResponse(res: StoriesResponse): object {
  return {
    numResults: res.numResults,
    returnedCount: res.results?.length ?? 0,
    stories: (res.results || []).slice(0, 6).map(s => ({
      name: s.name,
      uniqueCount: s.uniqueCount,
      totalCount: s.totalCount,
      updatedAt: s.updatedAt,
    })),
  };
}

function summarizeVectorResponse(res: VectorResponse): object {
  return {
    numResults: res.numResults,
    articles: (res.articles || []).slice(0, 6).map(a => ({
      title: a.title,
      source: a.source?.domain,
      score: a.score,
      url: a.url,
    })),
  };
}

async function runRequest(req: PerigonRequest): Promise<NewsCard[]> {
  log('orchestrator', `Calling Perigon /${req.kind} endpoint`);
  logJson('orchestrator', `${req.kind} params`, req.params);

  switch (req.kind) {
    case 'articles': {
      const res = await fetchArticles(req.params);
      logJson('orchestrator', `articles response (${res.articles?.length ?? 0} results)`, summarizeArticlesResponse(res));
      return (res.articles || []).map((a) => articleToCard(a));
    }
    case 'stories': {
      const res = await fetchStories(req.params);
      logJson('orchestrator', `stories response (${res.results?.length ?? 0} results)`, summarizeStoriesResponse(res));
      return (res.results || []).map(storyToCard);
    }
    case 'vector': {
      const res = await fetchVector(req.params);
      logJson('orchestrator', `vector response (${res.articles?.length ?? 0} results)`, summarizeVectorResponse(res));
      // Filter weak vector matches.
      const filtered = (res.articles || []).filter((a) => (a.score ?? 0) >= 0.65);
      log('orchestrator', `vector: ${res.articles?.length ?? 0} raw → ${filtered.length} after score >= 0.65 filter`);
      return filtered.map((a) => articleToCard(a, a.score));
    }
    default: {
      const exhaustive: never = req;
      throw new Error(`Unknown PerigonRequest kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

async function runRequestsInParallel(requests: PerigonRequest[]): Promise<{ cards: NewsCard[]; calls: number }> {
  if (requests.length === 0) return { cards: [], calls: 0 };
  const settled = await Promise.allSettled(requests.map(runRequest));
  const cards: NewsCard[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      cards.push(...r.value);
    } else {
      console.error(`[news/orchestrator] request ${i} failed:`, r.reason);
    }
  }
  return { cards, calls: requests.length };
}

// ─── Top-level orchestration ─────────────────────────────────────────

export async function fetchForPlan(plan: QueryPlan): Promise<OrchestratorResult> {
  let totalCalls = 0;
  let usedFallback = false;

  // 1. Initial request set.
  const initialRequests = buildRequests(plan);
  log('orchestrator', `Shape="${plan.shape}" → ${initialRequests.length} initial request(s): [${initialRequests.map(r => r.kind).join(', ')}]`);
  const { cards: initialCards, calls } = await runRequestsInParallel(initialRequests);
  totalCalls += calls;

  let cards = dedupByUrl(initialCards);
  log('orchestrator', `After initial fetch + dedup: ${cards.length} cards`);

  // 2. Sparse cascade — niche shape only. Broad/entity/conceptual either come
  //    back full or are acceptable empty (broad: no big stories in 3 days).
  if (plan.shape === 'niche' && cards.length < MIN_RESULTS_BEFORE_CASCADE) {
    log('orchestrator', `Sparse result (${cards.length} < ${MIN_RESULTS_BEFORE_CASCADE}), starting cascade`);
    for (let step = 1; step <= MAX_CASCADE_STEPS; step++) {
      const next = nextFallback({ plan, step });
      if (!next) break;
      try {
        log('orchestrator', `Cascade step ${step}: ${next.request.kind}${next.usedTaxonomyFallback ? ' (taxonomy fallback)' : ''}`);
        const more = await runRequest(next.request);
        totalCalls += 1;
        if (next.usedTaxonomyFallback) usedFallback = true;
        cards = dedupByUrl([...cards, ...more]);
        log('orchestrator', `After cascade step ${step}: ${cards.length} cards`);
        if (cards.length >= MIN_RESULTS_BEFORE_CASCADE) break;
      } catch (err) {
        console.error(`[news/orchestrator] fallback step ${step} failed:`, err);
      }
    }
  }

  // 3. Rank, diversify, cap.
  const ranked = rankCards(cards, plan.shape);
  log('orchestrator', `After rank + diversify + cap: ${ranked.length} cards (from ${cards.length} pre-rank)`);
  logJson('orchestrator', 'Final cards', ranked.map(c => ({
    title: c.title,
    source: c.source,
    kind: c.kind,
    pubDate: c.pubDate,
    url: c.url,
    uniqueSources: c.uniqueSources,
    vectorScore: c.vectorScore,
  })));

  return { cards: ranked, usedFallback, perigonCalls: totalCalls };
}
