// Vendored from src/lib/news/routing.ts (commit 8afca519)

import type { QueryPlan, PerigonCategory } from './query-planner.js';
import { daysAgoISO } from './normalize.js';
import type { ArticlesSearchParams, StoriesSearchParams, VectorSearchParams } from './perigon-client.js';

export const MAX_CARDS_PER_TOPIC = 6;
export const BROAD_FROM_DAYS = 3;
export const NICHE_FROM_DAYS = 30;
export const ENTITY_FROM_DAYS = 3;
export const CONCEPTUAL_FROM_DAYS = 30;
export const BROAD_MIN_UNIQUE_SOURCES = 5;

export const BROAD_TOP100_CATEGORIES: ReadonlySet<PerigonCategory> = new Set([
  'Politics',
  'World',
]);

export const DEFAULT_EXCLUDE_LABELS = ['Press Release', 'Non-news', 'Opinion'];
export const OVERFETCH_SIZE = 20;

export type PerigonRequest =
  | { kind: 'articles'; params: ArticlesSearchParams }
  | { kind: 'stories'; params: StoriesSearchParams }
  | { kind: 'vector'; params: VectorSearchParams };

function broadRequest(plan: QueryPlan): PerigonRequest {
  const useTop100 = plan.category ? BROAD_TOP100_CATEGORIES.has(plan.category) : false;
  const params: StoriesSearchParams = {
    q: plan.canonicalQuery,
    sortBy: 'updatedAt',
    size: OVERFETCH_SIZE,
    from: daysAgoISO(BROAD_FROM_DAYS),
    minUniqueSources: BROAD_MIN_UNIQUE_SOURCES,
    language: ['en'],
    ...(useTop100 ? { sourceGroup: ['top100'] } : {}),
    ...(plan.category ? { category: [plan.category] } : {}),
    ...(plan.topic ? { topic: [plan.topic] } : {}),
  };
  return { kind: 'stories', params };
}

function entityRequest(plan: QueryPlan): PerigonRequest {
  const params: ArticlesSearchParams = {
    sortBy: 'date',
    size: 15,
    from: daysAgoISO(ENTITY_FROM_DAYS),
    sourceGroup: ['top100'],
    excludeLabel: DEFAULT_EXCLUDE_LABELS,
    showReprints: false,
    language: ['en'],
    medium: ['Article'],
  };
  if (plan.companyName) {
    params.companyName = plan.companyName;
  } else {
    params.q = plan.canonicalQuery;
  }
  return { kind: 'articles', params };
}

function nicheRequest(plan: QueryPlan, fromDays = NICHE_FROM_DAYS): PerigonRequest {
  const params: ArticlesSearchParams = {
    q: plan.canonicalQuery,
    sortBy: 'relevance',
    size: OVERFETCH_SIZE,
    from: daysAgoISO(fromDays),
    excludeLabel: ['Press Release', 'Non-news'],
    showReprints: false,
    language: ['en'],
    medium: ['Article'],
  };
  return { kind: 'articles', params };
}

function conceptualRequests(plan: QueryPlan): PerigonRequest[] {
  const articles: PerigonRequest = {
    kind: 'articles',
    params: {
      q: plan.canonicalQuery,
      sortBy: 'relevance',
      size: 15,
      from: daysAgoISO(CONCEPTUAL_FROM_DAYS),
      excludeLabel: DEFAULT_EXCLUDE_LABELS,
      showReprints: false,
      language: ['en'],
      medium: ['Article'],
    },
  };
  const vector: PerigonRequest = {
    kind: 'vector',
    params: { prompt: plan.vectorPrompt || plan.canonicalQuery, size: 15 },
  };
  return [articles, vector];
}

export function buildRequests(plan: QueryPlan): PerigonRequest[] {
  switch (plan.shape) {
    case 'broad': return [broadRequest(plan)];
    case 'entity': return [entityRequest(plan)];
    case 'niche': return [nicheRequest(plan)];
    case 'conceptual': return conceptualRequests(plan);
  }
}

export interface CascadeContext {
  plan: QueryPlan;
  step: number;
}

export function nextFallback(ctx: CascadeContext): { request: PerigonRequest; usedTaxonomyFallback: boolean } | null {
  const { plan, step } = ctx;
  switch (step) {
    case 1:
      return { request: nicheRequest(plan, 90), usedTaxonomyFallback: false };
    case 2:
      return {
        request: {
          kind: 'articles',
          params: {
            q: plan.canonicalQuery,
            sortBy: 'relevance',
            size: OVERFETCH_SIZE,
            from: daysAgoISO(180),
            excludeLabel: ['Press Release'],
            showReprints: false,
            language: ['en'],
            medium: ['Article'],
          },
        },
        usedTaxonomyFallback: false,
      };
    case 3:
      return {
        request: { kind: 'vector', params: { prompt: plan.vectorPrompt || plan.canonicalQuery, size: 15 } },
        usedTaxonomyFallback: false,
      };
    case 4:
      if (!plan.category && !plan.topic) return null;
      return {
        request: {
          kind: 'stories',
          params: {
            sortBy: 'updatedAt',
            size: OVERFETCH_SIZE,
            from: daysAgoISO(BROAD_FROM_DAYS),
            minUniqueSources: 3,
            language: ['en'],
            ...(plan.category ? { category: [plan.category] } : {}),
            ...(plan.topic ? { topic: [plan.topic] } : {}),
          },
        },
        usedTaxonomyFallback: true,
      };
    default:
      return null;
  }
}
