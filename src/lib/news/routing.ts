// Maps a QueryPlan to one or more PerigonRequests.
//
// All knobs that we may want to tune later live as exported constants at the
// top of the file so they're easy to find.

import type { QueryPlan, PerigonCategory } from './query-planner';
import { daysAgoISO } from './normalize';
import type { ArticlesSearchParams, StoriesSearchParams, VectorSearchParams } from './perigon-client';

// ─── Tunables ────────────────────────────────────────────────────────

/** Hard cap on cards returned per topic. */
export const MAX_CARDS_PER_TOPIC = 6;

/** How many days back to look. */
export const BROAD_FROM_DAYS = 3;
export const NICHE_FROM_DAYS = 30;
export const ENTITY_FROM_DAYS = 3;
export const CONCEPTUAL_FROM_DAYS = 30;

/** Cluster-quality bar for /stories/all on broad queries. */
export const BROAD_MIN_UNIQUE_SOURCES = 5;

/**
 * Per-category overrides for `sourceGroup=top100` on broad queries.
 * Default for broad is OFF (specialty pubs are valuable for tech/AI/etc).
 * Categories listed here force top100 ON.
 */
export const BROAD_TOP100_CATEGORIES: ReadonlySet<PerigonCategory> = new Set([
  'Politics',
  'World',
]);

/** Default labels excluded from broad/niche fetches. */
export const DEFAULT_EXCLUDE_LABELS = ['Press Release', 'Non-news', 'Opinion'];

/** Over-fetch factor — fetch this many results so rank+diversify can pick the top N. */
export const OVERFETCH_SIZE = 20;

// ─── Request shapes ──────────────────────────────────────────────────

export type PerigonRequest =
  | { kind: 'articles'; params: ArticlesSearchParams }
  | { kind: 'stories'; params: StoriesSearchParams }
  | { kind: 'vector'; params: VectorSearchParams };

// ─── Builders ────────────────────────────────────────────────────────

function broadRequest(plan: QueryPlan): PerigonRequest {
  const useTop100 = plan.category ? BROAD_TOP100_CATEGORIES.has(plan.category) : false;
  const params: StoriesSearchParams = {
    q: plan.canonicalQuery,
    sortBy: 'updatedAt', // /stories/all has no importance sort; we re-rank locally
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
    // No sourceGroup — niche topics need specialty pubs.
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
    params: {
      prompt: plan.vectorPrompt || plan.canonicalQuery,
      size: 15,
    },
  };
  return [articles, vector];
}

/** Top-level: build the initial request set for a plan. */
export function buildRequests(plan: QueryPlan): PerigonRequest[] {
  switch (plan.shape) {
    case 'broad':
      return [broadRequest(plan)];
    case 'entity':
      return [entityRequest(plan)];
    case 'niche':
      return [nicheRequest(plan)];
    case 'conceptual':
      return conceptualRequests(plan);
  }
}

// ─── Sparse cascade builders ─────────────────────────────────────────
//
// Each step returns a single new request to try, OR null when the cascade
// has been exhausted. The orchestrator owns the retry loop.

export interface CascadeContext {
  plan: QueryPlan;
  step: number;
}

/**
 * Returns the next fallback request to try after a sparse result.
 * Step 1: widen date window.
 * Step 2: drop quality filters (keep Press Release exclusion).
 * Step 3: broaden the query (no-op here — the planner already OR-joined; rely on sortBy=relevance).
 * Step 4: vector fallback.
 * Step 5: nearest taxonomy /stories/all fallback.
 * Returns null when exhausted.
 */
export function nextFallback(ctx: CascadeContext): { request: PerigonRequest; usedTaxonomyFallback: boolean } | null {
  const { plan, step } = ctx;

  switch (step) {
    case 1: // widen date window
      return { request: nicheRequest(plan, 90), usedTaxonomyFallback: false };

    case 2: // widen window again + drop quality filters
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

    case 3: // vector fallback
      return {
        request: {
          kind: 'vector',
          params: {
            prompt: plan.vectorPrompt || plan.canonicalQuery,
            size: 15,
          },
        },
        usedTaxonomyFallback: false,
      };

    case 4: // taxonomy fallback — last resort
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
