import { resolveTopics } from './query-planner';
import { fetchArticlesForTopic } from './article-fetcher';
import { fetchArticlesViaWebSearch } from './agentic-fetcher';
import { fetchArticlesViaSearchApi } from './search-fetcher';
import { assembleSection, sectionCacheId, type StoryCard, type Article } from './briefing-assembler';
import { getCachedSection } from './perigon-cache';
import { getOpenAIModel } from './models';
import { filterRecentStories } from './filter-stories';
import { type BriefingSettings } from './prompts';

// ─── Public types ─────────────────────────────────────────────────────

interface DebugQueryInfo {
  type: string;
  query: string;
  vectorQuery?: string;
}

interface DebugInfo {
  queries: DebugQueryInfo[];
  articleCount: number;
  cascadeStep?: string;
}

interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  stories: StoryCard[];
  articles: Article[];
  generatedAt: string;
  model: string;
  debugInfo?: DebugInfo;
}

export interface BriefingResponse {
  briefings: Briefing[];
  model: string;
}

// Settings as sent by the frontend
interface GenerateSettings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks?: boolean;
  tone: 'casual' | 'professional' | 'technical';
  skipCache?: boolean;
}

// ─── Main pipeline ────────────────────────────────────────────────────

export async function generateBriefing(
  topics: { id?: string; name: string; emoji?: string }[],
  settings: GenerateSettings,
): Promise<BriefingResponse> {
  const model = getOpenAIModel();
  const briefingSettings: BriefingSettings = {
    briefingLength: settings.briefingLength || 'medium',
    tone: settings.tone || 'professional',
  };

  const skipCache = settings.skipCache === true;
  if (skipCache) console.log('🚫 Cache bypassed (dev mode)');

  // 1 + 2. Gather articles for ALL topics in parallel.
  //    - search-api: direct search-API calls + cheap-LLM query planning
  //    - agentic: one web-search LLM call per topic (no separate planner call)
  //    - perigon: query planner → Perigon endpoints with cascade fallback
  const newsSource = process.env.NEWS_SOURCE || 'perigon';
  let articleResults: PromiseSettledResult<Awaited<ReturnType<typeof fetchArticlesForTopic>>>[];
  if (newsSource === 'search-api') {
    articleResults = await Promise.allSettled(
      topics.map(t => fetchArticlesViaSearchApi(t.name, skipCache))
    );
  } else if (newsSource === 'agentic') {
    articleResults = await Promise.allSettled(
      topics.map(t => fetchArticlesViaWebSearch(t.name, skipCache))
    );
  } else {
    const resolved = await resolveTopics(topics, { skipCache });
    articleResults = await Promise.allSettled(
      resolved.map(r => fetchArticlesForTopic(r, skipCache))
    );
  }

  // Build debug info from fetch results (both fetchers report the same shape)
  const debugInfoByIndex: (DebugInfo | undefined)[] = topics.map((_, i) => {
    const fetchResult = articleResults[i];
    if (fetchResult?.status !== 'fulfilled') return undefined;
    return fetchResult.value.debugInfo;
  });

  // 3. Assemble ALL briefings with LLM in parallel
  const assemblyTasks = topics.map(async (original, i) => {
    const topicDebugInfo = debugInfoByIndex[i];
    const cacheId = sectionCacheId(original.name);

    // Check section cache first (so we can skip article fetch errors for cached topics)
    const cachedSection = skipCache ? null : await getCachedSection(cacheId);
    if (cachedSection) {
      console.log(`📦 Using cached briefing section for "${original.name}"`);
      return {
        topic: original.name,
        emoji: original.emoji || '',
        summary: cachedSection.summary,
        stories: filterRecentStories(cachedSection.stories),
        articles: settings.includeLinks !== false ? cachedSection.articles.slice(0, 5) : [],
        generatedAt: cachedSection.generatedAt,
        model,
        debugInfo: topicDebugInfo,
      } as Briefing;
    }

    const articleResult = articleResults[i];
    if (articleResult.status === 'rejected') {
      console.error(`❌ Article fetch failed for "${original.name}":`, articleResult.reason);
      return null;
    }

    const { articles } = articleResult.value;
    if (articles.length === 0) {
      console.warn(`⚠️ No articles found for "${original.name}", skipping`);
      return null;
    }

    try {
      console.log(`🤖 Assembling briefing for "${original.name}" with ${articles.length} articles...`);
      const section = await assembleSection(original.name, articles, briefingSettings, skipCache);

      return {
        topic: original.name,
        emoji: original.emoji || '',
        summary: section.summary,
        stories: section.stories,
        articles: settings.includeLinks !== false ? section.articles.slice(0, 5) : [],
        generatedAt: section.generatedAt,
        model,
        debugInfo: topicDebugInfo,
      } as Briefing;
    } catch (err) {
      console.error(`❌ LLM assembly failed for "${original.name}":`, err);
      return {
        topic: original.name,
        emoji: original.emoji || '',
        summary: `Latest news about ${original.name}.`,
        stories: [],
        articles: [],
        generatedAt: new Date().toISOString(),
        model,
      } as Briefing;
    }
  });

  const results = await Promise.all(assemblyTasks);
  const briefings = results.filter((b): b is Briefing => b !== null);

  return { briefings, model };
}

// ─── Simplified wrapper for cron jobs (takes topic name strings) ──────

export async function generateBriefingsForCron(
  topicNames: string[],
): Promise<{ topic: string; summary: string; stories: StoryCard[]; articles: Article[] }[]> {
  const topics = topicNames.map(name => ({ name }));
  const result = await generateBriefing(topics, {
    briefingLength: 'medium',
    tone: 'professional',
    includeLinks: true,
  });
  return result.briefings.map(b => ({
    topic: b.topic,
    summary: b.summary,
    stories: b.stories,
    articles: b.articles,
  }));
}
