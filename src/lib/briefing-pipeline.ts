// Single entry point for briefing generation, used by /api/generate and the
// cron routes:  topics → gather (Brave/Exa) → assemble (LLM) → section cache.

import { gatherArticles } from './gather';
import { assembleSection, sectionCacheId, type StoryCard, type Article } from './briefing-assembler';
import { getCachedSection } from './briefing-cache';
import { getAssemblyModel } from './models';
import { filterRecentStories } from './filter-stories';
import { getMarketSnapshot } from './market-snapshot';

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
  /** Market levels line ("S&P 500 7,691 (−1.5%) · …") for finance-flavored topics. */
  snapshot?: string;
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
        const [section, snapshot] = await Promise.all([
          assembleSection(topic.name, gathered.articles, assemblySettings),
          gathered.market ? getMarketSnapshot() : Promise.resolve(null),
        ]);
        return {
          topic: topic.name,
          emoji: topic.emoji || '',
          summary: section.summary,
          snapshot: snapshot ?? undefined,
          stories: section.stories,
          articles: includeLinks ? citedFirst(section.stories, section.articles).slice(0, 5) : [],
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

  return { briefings: snapshotOnce(dedupeAcrossTopics(briefings)), model };
}

/** The market line is briefing-wide; show it on the first markets topic only. */
function snapshotOnce(briefings: Briefing[]): Briefing[] {
  let shown = false;
  return briefings.map(b => {
    if (!b.snapshot) return b;
    if (shown) return { ...b, snapshot: undefined };
    shown = true;
    return b;
  });
}

/** "Sources" = exactly what the stories cite. Listing rejected articles advertised the junk the writer correctly skipped (every Oct 19 reviewer flagged it). */
function citedFirst(stories: StoryCard[], articles: Article[]): Article[] {
  const cited = new Set(stories.map(s => s.url).filter(Boolean));
  return articles.filter(a => cited.has(a.url));
}

/**
 * One event gets one home: a story URL used by an earlier topic is dropped
 * from later ones — but never below MIN_STORIES_AFTER_DEDUPE, because
 * overlapping topics ("Finance" + "Stock Market") otherwise leave the second
 * one empty (Oct 19 finance review: "Stock Market has a summary and no stories").
 */
const MIN_STORIES_AFTER_DEDUPE = 2;
function dedupeAcrossTopics(briefings: Briefing[]): Briefing[] {
  const used = new Set<string>();
  return briefings.map(b => {
    const unique = b.stories.filter(s => !s.url || !used.has(s.url));
    const stories = unique.length >= MIN_STORIES_AFTER_DEDUPE ? unique : b.stories;
    for (const s of stories) if (s.url) used.add(s.url);
    return { ...b, stories };
  });
}

/** Cron wrapper: topic-name strings in, flat briefing items out (empties dropped). */
export async function generateBriefingsForCron(
  topicNames: string[],
): Promise<{ topic: string; summary: string; snapshot?: string; stories: StoryCard[]; articles: Article[] }[]> {
  const result = await generateBriefing(
    topicNames.map(name => ({ name })),
    { briefingLength: 'medium', tone: 'professional', includeLinks: true },
  );
  return result.briefings
    .filter(b => !b.empty)
    .map(b => ({ topic: b.topic, summary: b.summary, snapshot: b.snapshot, stories: b.stories, articles: b.articles }));
}
