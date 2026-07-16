/**
 * perigon-cache.ts — preserved public interface.
 *
 * The four unified cache layers have moved to briefing-cache.ts.
 * This file re-exports the types and delegates to briefing-cache.ts
 * so that existing callers (briefing-generator.ts, etc.) need no changes.
 */

import { getCached, setCached } from './news/cache';
import {
  getCachedQueryArticles as _getCachedQueryArticles,
  setCachedQueryArticles as _setCachedQueryArticles,
  getCachedSection as _getCachedSection,
  setCachedSection as _setCachedSection,
  type PerigonResult,
  type TopicBriefingSection,
} from './briefing-cache';

// ─── Re-exported types (defined in briefing-cache.ts) ─────────────────

export type { PerigonResult, TopicBriefingSection };

// ─── Legacy article cache (by topic ID) ──────────────────────────────
// Not moved to briefing-cache.ts because the key schema
// ("perigon:articles:<topicId>") is not one of the four unified layers.

const LEGACY_TTL_SECONDS = 6 * 60 * 60; // 6 hours

function articlesKey(topicId: string) {
  return `perigon:articles:${topicId}`;
}

function lastFetchKey(topicId: string) {
  return `perigon:last_fetch:${topicId}`;
}

export async function getCachedArticles(topicId: string): Promise<PerigonResult | null> {
  return getCached<PerigonResult>(articlesKey(topicId));
}

export async function setCachedArticles(topicId: string, data: PerigonResult): Promise<void> {
  await setCached(articlesKey(topicId), data, LEGACY_TTL_SECONDS);
  await setCached(lastFetchKey(topicId), new Date().toISOString(), LEGACY_TTL_SECONDS);
}

// ─── Query-based article cache — delegates to briefing-cache.ts ───────

export async function getCachedQueryArticles(type: string, query: string): Promise<PerigonResult | null> {
  return _getCachedQueryArticles(type, query);
}

export async function setCachedQueryArticles(type: string, query: string, data: PerigonResult): Promise<void> {
  return _setCachedQueryArticles(type, query, data);
}

// ─── Section cache — delegates to briefing-cache.ts ──────────────────

export async function getCachedSection(topicId: string): Promise<TopicBriefingSection | null> {
  return _getCachedSection(topicId);
}

export async function setCachedSection(topicId: string, section: TopicBriefingSection): Promise<void> {
  return _setCachedSection(topicId, section);
}
