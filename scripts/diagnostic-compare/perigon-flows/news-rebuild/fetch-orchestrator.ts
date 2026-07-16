// Vendored from src/lib/news/fetch-orchestrator.ts (commit 8afca519)
// Changes: removed logger import (replaced with console.log)

import { fetchArticles, fetchStories, fetchVector } from './perigon-client.js';
import type { ArticlesResponse, StoriesResponse, VectorResponse } from './perigon-client.js';
import type { PerigonRequest } from './routing.js';
import { buildRequests, nextFallback } from './routing.js';
import type { QueryPlan } from './query-planner.js';
import { articleToCard, dedupByUrl, rankCards, storyToCard } from './rank.js';
import type { NewsCard } from './rank.js';

const MIN_RESULTS_BEFORE_CASCADE = 5;
const MAX_CASCADE_STEPS = 4;

export interface OrchestratorResult {
  cards: NewsCard[];
  usedFallback: boolean;
  perigonCalls: number;
}

async function runRequest(req: PerigonRequest): Promise<NewsCard[]> {
  switch (req.kind) {
    case 'articles': {
      const res: ArticlesResponse = await fetchArticles(req.params);
      return (res.articles || []).map((a) => articleToCard(a));
    }
    case 'stories': {
      const res: StoriesResponse = await fetchStories(req.params);
      return (res.results || []).map(storyToCard);
    }
    case 'vector': {
      const res: VectorResponse = await fetchVector(req.params);
      const filtered = (res.articles || []).filter((a) => (a.score ?? 0) >= 0.65);
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
      console.error(`[news-rebuild/orchestrator] request ${i} failed:`, r.reason);
    }
  }
  return { cards, calls: requests.length };
}

export async function fetchForPlan(plan: QueryPlan): Promise<OrchestratorResult> {
  let totalCalls = 0;
  let usedFallback = false;

  const initialRequests = buildRequests(plan);
  const { cards: initialCards, calls } = await runRequestsInParallel(initialRequests);
  totalCalls += calls;

  let cards = dedupByUrl(initialCards);

  if (plan.shape === 'niche' && cards.length < MIN_RESULTS_BEFORE_CASCADE) {
    for (let step = 1; step <= MAX_CASCADE_STEPS; step++) {
      const next = nextFallback({ plan, step });
      if (!next) break;
      try {
        const more = await runRequest(next.request);
        totalCalls += 1;
        if (next.usedTaxonomyFallback) usedFallback = true;
        cards = dedupByUrl([...cards, ...more]);
        if (cards.length >= MIN_RESULTS_BEFORE_CASCADE) break;
      } catch (err) {
        console.error(`[news-rebuild/orchestrator] fallback step ${step} failed:`, err);
      }
    }
  }

  const ranked = rankCards(cards, plan.shape);
  return { cards: ranked, usedFallback, perigonCalls: totalCalls };
}
