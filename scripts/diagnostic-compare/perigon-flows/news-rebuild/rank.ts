// Vendored from src/lib/news/rank.ts (commit 8afca519)

import { canonicalUrl, hostOf } from './normalize.js';
import type { PerigonArticle, PerigonStory } from './perigon-client.js';
import type { QueryShape } from './query-planner.js';
import { MAX_CARDS_PER_TOPIC } from './routing.js';

export interface NewsCard {
  id: string;
  kind: 'story' | 'article';
  title: string;
  summary: string;
  longSummary?: string;
  url: string;
  source: string;
  pubDate: string;
  imageUrl?: string;
  clusterId?: string;
  uniqueSources?: number;
  totalArticles?: number;
  vectorScore?: number;
  topPeople?: string[];
  topCompanies?: string[];
}

function pickStoryUrl(story: PerigonStory): string {
  const first = story.selectedArticles?.[0]?.url;
  if (first) return first;
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

interface ShapeScoring {
  relevanceWeight: number;
  recencyWeight: number;
  recencyHalfLifeHours: number;
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

function relevanceScore(card: NewsCard, indexInBatch: number, batchSize: number): number {
  if (card.kind === 'story') {
    const u = Math.min(card.uniqueSources ?? 0, 30) / 30;
    const t = Math.min(card.totalArticles ?? 0, 100) / 100;
    return 0.6 * u + 0.4 * t;
  }
  if (card.vectorScore !== undefined) return Math.max(0, Math.min(1, card.vectorScore));
  return 1 - indexInBatch / Math.max(batchSize, 1);
}

export function scoreAndSort(cards: NewsCard[], shape: QueryShape): NewsCard[] {
  const cfg = SCORING[shape];
  const scored = cards.map((card, idx) => ({
    card,
    score:
      cfg.relevanceWeight * relevanceScore(card, idx, cards.length) +
      cfg.recencyWeight * recencyScore(card.pubDate, cfg.recencyHalfLifeHours),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.card);
}

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

export function rankCards(cards: NewsCard[], shape: QueryShape): NewsCard[] {
  return diversifyAndCap(scoreAndSort(dedupByUrl(cards), shape), shape);
}
