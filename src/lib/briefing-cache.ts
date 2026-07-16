/**
 * briefing-cache.ts — unified cache layer for all four caching concerns.
 *
 * Cache layers and their TTLs:
 *   queryArticles  — Perigon API results keyed by (type, query)       6 h
 *   section        — Pre-assembled briefing section keyed by topicId  6 h
 *   queryPlan      — LLM query plan keyed by topic name               24 h
 *   scheduleDay    — Pre-generated cron briefings keyed by date        24 h
 *
 * Key schemas (preserved for backward-compatibility with live cached data):
 *   queryArticles  → "perigon:q:<hash>"
 *   section        → "perigon:section:<topicId>"
 *   queryPlan      → "queryplan:topic:<topicName>"
 *   scheduleDay    → "briefings:cache:<date>"
 *
 * All Redis I/O is routed through src/lib/news/cache.ts (getCached / setCached)
 * which owns the singleton Redis client, timeout wrapper, and error handling.
 *
 * Types for queryArticles and section are defined here (not in perigon-cache.ts)
 * to avoid circular imports. perigon-cache.ts re-exports them.
 */

import { getCached, setCached, getRedis } from './news/cache';
import type { PerigonArticlesResponse } from './perigon';

// Inline the QueryInstruction + QueryPlan shape here to avoid a circular
// import with query-planner.ts (which imports getCachedQueryPlan from this file).
interface _QueryInstruction {
  type: 'articles' | 'vector' | 'both';
  query: string;
  vectorQuery?: string;
  perigonCategory?: string;
  perigonTopic?: string;
  companyName?: string;
  useStories?: boolean;
}

interface _QueryPlan {
  originalTopic: string;
  queries: _QueryInstruction[];
}

// ─── Layer names ──────────────────────────────────────────────────────

export type CacheLayer = 'queryArticles' | 'section' | 'queryPlan' | 'scheduleDay';

// ─── Shared types (re-exported by perigon-cache.ts for backward-compat) ──

/** Cached Perigon API response (both article search and vector search
 *  are normalized to PerigonArticlesResponse) */
export type PerigonResult = { data: PerigonArticlesResponse };

/** Pre-generated briefing section for a single topic */
export interface TopicBriefingSection {
  topic: string;
  summary: string;
  stories: {
    headline: string;
    bullets: string[];
    source?: string;
    url?: string;
    date?: string;
  }[];
  articles: {
    title: string;
    source: string;
    url: string;
    snippet?: string;
  }[];
  generatedAt: string;
}

// ─── scheduleDay types ────────────────────────────────────────────────

interface ScheduledBriefingArticle {
  title: string;
  url: string;
  source: string;
}

interface ScheduledBriefingStory {
  headline: string;
  bullets: string[];
  source?: string;
  url?: string;
  date?: string;
}

interface ScheduledBriefingItem {
  topic: string;
  summary: string;
  stories: ScheduledBriefingStory[];
  articles: ScheduledBriefingArticle[];
}

export interface ScheduledBriefing {
  email: string;
  topics: string[];
  briefings: ScheduledBriefingItem[];
  generatedAt: string;
}

// ─── TTL constants ────────────────────────────────────────────────────

const QUERY_ARTICLES_TTL = 6 * 60 * 60;  // 6 hours
const SECTION_TTL        = 6 * 60 * 60;  // 6 hours
const QUERY_PLAN_TTL     = 24 * 60 * 60; // 24 hours
const SCHEDULE_DAY_TTL   = 24 * 60 * 60; // 24 hours

// ─── Key generators ───────────────────────────────────────────────────

/** Matches the hash logic in the original perigon-cache.ts */
function queryArticlesKey(type: string, query: string): string {
  const normalized = `${type}:${query.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `perigon:q:${Math.abs(hash).toString(36)}`;
}

function sectionKey(topicId: string): string {
  return `perigon:section:${topicId}`;
}

function queryPlanKey(topicName: string): string {
  return `queryplan:topic:${topicName.toLowerCase().trim()}`;
}

function scheduleDayKey(date: string): string {
  return `briefings:cache:${date}`;
}

// ─── Query articles cache (6h TTL) ───────────────────────────────────

export async function getCachedQueryArticles(
  type: string,
  query: string,
): Promise<PerigonResult | null> {
  return getCached<PerigonResult>(queryArticlesKey(type, query));
}

export async function setCachedQueryArticles(
  type: string,
  query: string,
  data: PerigonResult,
): Promise<void> {
  await setCached(queryArticlesKey(type, query), data, QUERY_ARTICLES_TTL);
}

// ─── Section briefing cache (6h TTL) ─────────────────────────────────

export async function getCachedSection(
  topicId: string,
): Promise<TopicBriefingSection | null> {
  return getCached<TopicBriefingSection>(sectionKey(topicId));
}

export async function setCachedSection(
  topicId: string,
  section: TopicBriefingSection,
): Promise<void> {
  await setCached(sectionKey(topicId), section, SECTION_TTL);
}

// ─── Query plan cache (24h TTL) ──────────────────────────────────────

export async function getCachedQueryPlan(
  topicName: string,
): Promise<_QueryPlan | null> {
  return getCached<_QueryPlan>(queryPlanKey(topicName));
}

export async function setCachedQueryPlan(
  topicName: string,
  plan: _QueryPlan,
): Promise<void> {
  await setCached(queryPlanKey(topicName), plan, QUERY_PLAN_TTL);
}

// ─── Schedule day cache (24h TTL) ────────────────────────────────────

export async function getCachedScheduleBriefings(
  date: string,
): Promise<ScheduledBriefing[] | null> {
  return getCached<ScheduledBriefing[]>(scheduleDayKey(date));
}

export async function setCachedScheduleBriefings(
  date: string,
  briefings: ScheduledBriefing[],
): Promise<void> {
  await setCached(scheduleDayKey(date), briefings, SCHEDULE_DAY_TTL);
}

export async function deleteCachedScheduleBriefings(date: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(scheduleDayKey(date));
  } catch (err) {
    console.error('[briefing-cache] del failed for scheduleDay:', err);
  }
}
