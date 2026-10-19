// Typed cache layers on top of news/cache.ts:
//   section      — assembled briefing section per topic id   6h   "briefing:section:<topicId>"
//   scheduleDay  — pre-generated cron briefings per UTC date  24h  "briefings:cache:<date>"

import { getCached, setCached, getRedis } from './news/cache';

export interface TopicBriefingSection {
  topic: string;
  summary: string;
  stories: { headline: string; bullets: string[]; source?: string; url?: string; date?: string }[];
  articles: { title: string; source: string; url: string; snippet?: string }[];
  generatedAt: string;
}

export interface ScheduledBriefing {
  email: string;
  topics: string[];
  briefings: {
    topic: string;
    summary: string;
    snapshot?: string;
    stories: { headline: string; bullets: string[]; source?: string; url?: string; date?: string }[];
    articles: { title: string; url: string; source: string }[];
  }[];
  generatedAt: string;
}

const SECTION_TTL = 6 * 60 * 60;
const SCHEDULE_DAY_TTL = 24 * 60 * 60;

const sectionKey = (topicId: string) => `briefing:section:${topicId}`;
export const scheduleDayKey = (date: string) => `briefings:cache:${date}`;

export async function getCachedSection(topicId: string): Promise<TopicBriefingSection | null> {
  return getCached<TopicBriefingSection>(sectionKey(topicId));
}

export async function setCachedSection(topicId: string, section: TopicBriefingSection): Promise<void> {
  await setCached(sectionKey(topicId), section, SECTION_TTL);
}

export async function getCachedScheduleBriefings(date: string): Promise<ScheduledBriefing[] | null> {
  return getCached<ScheduledBriefing[]>(scheduleDayKey(date));
}

export async function setCachedScheduleBriefings(date: string, briefings: ScheduledBriefing[]): Promise<void> {
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
