import { Redis } from '@upstash/redis';
import type { PerigonArticlesResponse } from './perigon';

// ─── Types ───────────────────────────────────────────────────────────

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

// ─── Redis helpers ───────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function articlesKey(topicId: string) {
  return `perigon:articles:${topicId}`;
}

function sectionKey(topicId: string) {
  return `perigon:section:${topicId}`;
}

function lastFetchKey(topicId: string) {
  return `perigon:last_fetch:${topicId}`;
}

/** Generate a cache key from query type + query string */
function queryArticlesKey(type: string, query: string): string {
  const normalized = `${type}:${query.toLowerCase().trim()}`;
  // Simple hash to keep keys short
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `perigon:q:${Math.abs(hash).toString(36)}`;
}

// ─── Legacy article cache (by topic ID) ──────────────────────────────

export async function getCachedArticles(topicId: string): Promise<PerigonResult | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const data = await redis.get<PerigonResult>(articlesKey(topicId));
    return data ?? null;
  } catch (err) {
    console.error('Error reading Perigon article cache:', err);
    return null;
  }
}

export async function setCachedArticles(topicId: string, data: PerigonResult): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(articlesKey(topicId), data, { ex: CACHE_TTL_SECONDS });
    await redis.set(lastFetchKey(topicId), new Date().toISOString(), { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('Error writing Perigon article cache:', err);
  }
}

// ─── Query-based article cache ───────────────────────────────────────

export async function getCachedQueryArticles(type: string, query: string): Promise<PerigonResult | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key = queryArticlesKey(type, query);
    const data = await redis.get<PerigonResult>(key);
    return data ?? null;
  } catch (err) {
    console.error('Error reading query article cache:', err);
    return null;
  }
}

export async function setCachedQueryArticles(type: string, query: string, data: PerigonResult): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = queryArticlesKey(type, query);
    await redis.set(key, data, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('Error writing query article cache:', err);
  }
}

// ─── Section cache ───────────────────────────────────────────────────

export async function getCachedSection(topicId: string): Promise<TopicBriefingSection | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const data = await redis.get<TopicBriefingSection>(sectionKey(topicId));
    return data ?? null;
  } catch (err) {
    console.error('Error reading Perigon section cache:', err);
    return null;
  }
}

export async function setCachedSection(topicId: string, section: TopicBriefingSection): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(sectionKey(topicId), section, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('Error writing Perigon section cache:', err);
  }
}
