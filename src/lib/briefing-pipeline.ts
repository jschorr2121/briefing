// Single entry point for briefing generation, used by /api/generate and the
// cron routes:  topics → gather (Brave/Exa) → assemble (LLM) → section cache.

import { gatherArticles } from './gather';
import { assembleSection, sectionCacheId, type StoryCard, type Article } from './briefing-assembler';
import { getCachedSection } from './briefing-cache';
import { getAssemblyModel } from './models';
import { filterRecentStories } from './filter-stories';

export interface TopicInput {
  id?: string;
  name: string;
  emoji?: string;
}

export interface GenerateSettings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks?: boolean;
  tone: 'casual' | 'professional' | 'technical';
  skipCache?: boolean;
}

export interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  stories: StoryCard[];
  articles: Article[];
  generatedAt: string;
  model: string;
  /** True when no usable coverage was found; the UI shows the summary as a notice. */
  empty?: boolean;
  debugInfo?: { queries: { type: string; query: string }[]; articleCount: number; cascadeStep?: string };
}

export interface BriefingResponse {
  briefings: Briefing[];
  model: string;
}

const emptyBriefing = (topic: TopicInput, model: string, summary: string): Briefing => ({
  topic: topic.name,
  emoji: topic.emoji || '',
  summary,
  stories: [],
  articles: [],
  generatedAt: new Date().toISOString(),
  model,
  empty: true,
});

export async function generateBriefing(topics: TopicInput[], settings: GenerateSettings): Promise<BriefingResponse> {
  const model = getAssemblyModel();
  const skipCache = settings.skipCache === true;
  const includeLinks = settings.includeLinks !== false;
  const assemblySettings = { briefingLength: settings.briefingLength || 'medium', tone: settings.tone || 'professional' };

  const briefings = await Promise.all(
    topics.map(async (topic): Promise<Briefing> => {
      const cacheId = sectionCacheId(topic.name);
      const cached = skipCache ? null : await getCachedSection(cacheId);
      if (cached) {
        console.log(`📦 Section cache hit for "${topic.name}"`);
        return {
          topic: topic.name,
          emoji: topic.emoji || '',
          summary: cached.summary,
          stories: filterRecentStories(cached.stories),
          articles: includeLinks ? cached.articles.slice(0, 5) : [],
          generatedAt: cached.generatedAt,
          model,
        };
      }

      let gathered;
      try {
        gathered = await gatherArticles(topic.name, skipCache);
      } catch (err) {
        console.error(`❌ Gather failed for "${topic.name}":`, err);
        return emptyBriefing(topic, model, `We couldn't fetch news for "${topic.name}" right now. Please try again in a moment.`);
      }
      if (gathered.articles.length === 0) {
        return emptyBriefing(topic, model, `No recent coverage found for "${topic.name}". Try a broader or more specific topic name.`);
      }

      try {
        console.log(`🤖 Assembling "${topic.name}" from ${gathered.articles.length} articles...`);
        const section = await assembleSection(topic.name, gathered.articles, assemblySettings);
        return {
          topic: topic.name,
          emoji: topic.emoji || '',
          summary: section.summary,
          stories: section.stories,
          articles: includeLinks ? section.articles.slice(0, 5) : [],
          generatedAt: section.generatedAt,
          model,
          debugInfo: gathered.debugInfo,
        };
      } catch (err) {
        console.error(`❌ Assembly failed for "${topic.name}":`, err);
        // Still useful: the raw gathered links.
        return {
          ...emptyBriefing(topic, model, `We found articles about "${topic.name}" but couldn't write the briefing. Here are the sources.`),
          articles: gathered.articles.slice(0, 5).map(a => ({ title: a.title, source: a.source, url: a.url })),
        };
      }
    })
  );

  return { briefings, model };
}

/** Cron wrapper: topic-name strings in, flat briefing items out (empties dropped). */
export async function generateBriefingsForCron(
  topicNames: string[],
): Promise<{ topic: string; summary: string; stories: StoryCard[]; articles: Article[] }[]> {
  const result = await generateBriefing(
    topicNames.map(name => ({ name })),
    { briefingLength: 'medium', tone: 'professional', includeLinks: true },
  );
  return result.briefings
    .filter(b => !b.empty)
    .map(b => ({ topic: b.topic, summary: b.summary, stories: b.stories, articles: b.articles }));
}
