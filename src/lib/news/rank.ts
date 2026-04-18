// Unified card type, scoring, dedup, and source diversification.
//
// Cards are the unit returned to the UI. They can be sourced from /stories/all
// (one cluster → one card), /articles/all (one article → one card), or
// /vector/news/all (same as articles, with a similarity score retained).

import { canonicalUrl, hostOf } from './normalize';
import type { PerigonArticle, PerigonStory } from './perigon-client';
import type { QueryShape } from './query-planner';
import { MAX_CARDS_PER_TOPIC } from './routing';

// ─── Card type ───────────────────────────────────────────────────────

export interface NewsCard {
  /** Stable ID for client-side keying. */
  id: string;
  kind: 'story' | 'article';
  title: string;
  /** Short, human-readable summary — taken straight from Perigon. */
  summary: string;
  /** Long form summary if Perigon provided one (optional, for tap-through). */
  longSummary?: string;
  /** Canonical URL — for `kind: "story"` this is the top article in the cluster. */
  url: string;
  source: string;
  pubDate: string;
  imageUrl?: string;
  /** Cluster ID for stories — used for the lazy "expand into articles" tap. */
  clusterId?: string;
  /** Number of unique sources in the cluster (stories only). */
  uniqueSources?: number;
  /** Total articles in the cluster (stories only). */
  totalArticles?: number;
  /** Vector similarity score, when sourced from vector search. */
  vectorScore?: number;
  /** Top entities for ranking + UI badges. */
  topPeople?: string[];
  topCompanies?: string[];
}

// ─── Conversion ──────────────────────────────────────────────────────

function pickStoryUrl(story: PerigonStory): string {
  // Prefer the first selected article URL; fall back to the slug-based Perigon page.
  const first = story.selectedArticles?.[0]?.url;
  if (first) return first;
  // Last resort: synthesize a stable id-based string so dedup still works.
  return `perigon-story://${story.id}`;
}

function pickStoryImage(story: PerigonStory): string | undefined {
  if (story.imageUrl) return story.imageUrl;
  return story.selectedArticles?.find((a) => a.imageUrl)?.imageUrl;
}

function pickStorySource(story: PerigonStory): string {
  const first = story.selectedArticles?.[0]?.source;
  return first?.name || first?.domain || story.uniqueSources?.[0] || 'multiple sources';
}

export function storyToCard(story: PerigonStory): NewsCard {
  const url = pickStoryUrl(story);
  return {
    id: `story:${story.id}`,
    kind: 'story',
    title: story.name,
    summary: story.shortSummary || story.summary || '',
    longSummary: story.summary,
    url: canonicalUrl(url),
    source: pickStorySource(story),
    pubDate: story.updatedAt,
    imageUrl: pickStoryImage(story),
    clusterId: story.id,
    uniqueSources: story.uniqueCount,
    totalArticles: story.totalCount,
    topPeople: story.topPeople?.map((p) => p.name),
    topCompanies: story.topCompanies?.map((c) => c.name),
  };
}

export function articleToCard(article: PerigonArticle, vectorScore?: number): NewsCard {
  const url = canonicalUrl(article.url);
  return {
    id: `article:${url}`,
    kind: 'article',
    title: article.title,
    summary: article.summary || article.description || '',
    longSummary: article.summary,
    url,
    source: article.source.name || article.source.domain,
    pubDate: article.pubDate,
    imageUrl: article.imageUrl,
    vectorScore,
  };
}

// ─── Dedup ───────────────────────────────────────────────────────────

/** Drop duplicates by canonical URL. Keeps the first occurrence. */
export function dedupByUrl(cards: NewsCard[]): NewsCard[] {
  const seen = new Set<string>();
  const out: NewsCard[] = [];
  for (const card of cards) {
    const key = canonicalUrl(card.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

// ─── Scoring ─────────────────────────────────────────────────────────

interface ShapeScoring {
  relevanceWeight: number;
  recencyWeight: number;
  /** Hours after which recency score has decayed by half. */
  recencyHalfLifeHours: number;
  /** Max cards from the same host. */
  maxPerHost: number;
}

const SCORING: Record<QueryShape, ShapeScoring> = {
  broad:      { relevanceWeight: 0.7, recencyWeight: 0.3, recencyHalfLifeHours: 36, maxPerHost: 1 },
  niche:      { relevanceWeight: 0.6, recencyWeight: 0.4, recencyHalfLifeHours: 96, maxPerHost: 2 },
  entity:     { relevanceWeight: 0.5, recencyWeight: 0.5, recencyHalfLifeHours: 24, maxPerHost: 2 },
  conceptual: { relevanceWeight: 0.6, recencyWeight: 0.4, recencyHalfLifeHours: 96, maxPerHost: 2 },
};

function recencyScore(pubDate: string, halfLifeHours: number): number {
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return 0;
  const ageHours = Math.max(0, (Date.now() - t) / (1000 * 60 * 60));
  return Math.exp(-Math.LN2 * (ageHours / halfLifeHours));
}

/**
 * For story cards, "relevance" is really cluster-importance: bigger clusters
 * with more unique sources are more important. For article cards we use the
 * inverse of the original API rank (so the first result scores highest), and
 * vector cards use their cosine score directly.
 */
function relevanceScore(card: NewsCard, indexInBatch: number, batchSize: number): number {
  if (card.kind === 'story') {
    // Combine unique sources (capped at 30) and total article count (capped at 100).
    // Both are normalized to 0..1, then averaged with a slight tilt to unique sources.
    const u = Math.min(card.uniqueSources ?? 0, 30) / 30;
    const t = Math.min(card.totalArticles ?? 0, 100) / 100;
    return 0.6 * u + 0.4 * t;
  }
  if (card.vectorScore !== undefined) {
    // Cosine score is already 0..1-ish.
    return Math.max(0, Math.min(1, card.vectorScore));
  }
  // Article from /articles/all sorted by relevance: rank-based.
  return 1 - indexInBatch / Math.max(batchSize, 1);
}

interface ScoredCard {
  card: NewsCard;
  score: number;
}

/**
 * Score and sort cards by hybrid relevance + recency for the given query shape.
 * Caller is expected to dedup before calling.
 */
export function scoreAndSort(cards: NewsCard[], shape: QueryShape): NewsCard[] {
  const cfg = SCORING[shape];
  const scored: ScoredCard[] = cards.map((card, idx) => ({
    card,
    score:
      cfg.relevanceWeight * relevanceScore(card, idx, cards.length) +
      cfg.recencyWeight * recencyScore(card.pubDate, cfg.recencyHalfLifeHours),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.card);
}

// ─── Source diversification ──────────────────────────────────────────

/**
 * Walk the sorted card list and skip any card that would push a host over its
 * max-per-host quota. Returns up to MAX_CARDS_PER_TOPIC cards.
 */
export function diversifyAndCap(cards: NewsCard[], shape: QueryShape): NewsCard[] {
  const cfg = SCORING[shape];
  const perHost: Record<string, number> = {};
  const out: NewsCard[] = [];

  for (const card of cards) {
    if (out.length >= MAX_CARDS_PER_TOPIC) break;
    const host = hostOf(card.url);
    const count = perHost[host] || 0;
    if (host && count >= cfg.maxPerHost) continue;
    perHost[host] = count + 1;
    out.push(card);
  }

  return out;
}

// ─── Combined helper ─────────────────────────────────────────────────

/** Full ranking pipeline: dedup → score+sort → diversify → cap. */
export function rankCards(cards: NewsCard[], shape: QueryShape): NewsCard[] {
  return diversifyAndCap(scoreAndSort(dedupByUrl(cards), shape), shape);
}
