import { resolveTopics, type QueryInstruction, type ResolvedTopic } from './query-planner';
import { searchArticlesAll, vectorSearchArticles, searchStories, type PerigonArticle } from './perigon';
import { getCachedQueryArticles, setCachedQueryArticles, getCachedSection, type PerigonResult } from './perigon-cache';
import { getOpenAIModel } from './models';
import { buildPerigonAssemblyPrompt, buildPerigonUserMessage, type PreparedArticle, type BriefingSettings, DEFAULT_SETTINGS } from './prompts';
import { filterRecentStories } from './filter-stories';

// ─── Types (matching existing frontend contract) ─────────────────────

interface Article {
  title: string;
  source: string;
  url: string;
  snippet?: string;
}

interface StoryCard {
  headline: string;
  bullets: string[];
  source?: string;
  url?: string;
  date?: string;
}

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
}

// ─── Article preparation helpers ─────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function prepareArticles(rawArticles: PerigonArticle[], limit: number): PreparedArticle[] {
  return rawArticles.slice(0, limit).map(a => ({
    title: a.title,
    source: a.source?.name || a.source?.domain || 'Unknown',
    date: formatDate(a.pubDate),
    summary: a.summary || a.description || '',
    url: a.url,
  }));
}

function toFrontendArticles(prepared: PreparedArticle[]): Article[] {
  const seen = new Set<string>();
  return prepared.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  }).map(a => ({
    title: a.title,
    source: a.source,
    url: a.url,
    snippet: a.summary?.substring(0, 150) || undefined,
  }));
}

/** Deduplicate articles by URL, preferring earlier entries (higher quality/relevance) */
function deduplicateArticles(articles: PerigonArticle[]): PerigonArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/** Interleave articles from multiple query results for balanced coverage */
function interleaveArticles(queryResults: PerigonArticle[][]): PerigonArticle[] {
  if (queryResults.length === 0) return [];
  if (queryResults.length === 1) return queryResults[0];

  const result: PerigonArticle[] = [];
  const maxLen = Math.max(...queryResults.map(r => r.length));

  for (let i = 0; i < maxLen; i++) {
    for (const articles of queryResults) {
      if (i < articles.length) {
        result.push(articles[i]);
      }
    }
  }

  return result;
}

// ─── Days-ago helper ─────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── Vector result post-filter ───────────────────────────────────────
// Vector search has no server-side filtering, so we filter client-side.

const VECTOR_MAX_AGE_DAYS = 7;
const EXCLUDED_LABELS = new Set(['Non-news', 'Opinion', 'Paid News', 'Press Release', 'Low Content']);

function filterVectorResults(articles: PerigonArticle[]): PerigonArticle[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VECTOR_MAX_AGE_DAYS);

  return articles.filter(a => {
    // Filter out old articles
    if (a.pubDate) {
      const pubDate = new Date(a.pubDate);
      if (!isNaN(pubDate.getTime()) && pubDate < cutoff) return false;
    }
    // Filter out excluded labels
    if (a.categories) {
      for (const cat of a.categories) {
        if (EXCLUDED_LABELS.has(cat.name)) return false;
      }
    }
    return true;
  });
}

// ─── Cascade fallback for a single QueryInstruction ──────────────────

interface ExecuteQueryResult {
  articles: PerigonArticle[];
  cascadeStep: string;
}

async function executeQuery(instruction: QueryInstruction): Promise<ExecuteQueryResult> {
  const { type, query, vectorQuery } = instruction;

  // Taxonomy + entity filters (from curated topics or LLM planner)
  const taxonomyFilters = {
    ...(instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}),
    ...(instruction.perigonTopic ? { topic: [instruction.perigonTopic] } : {}),
    ...(instruction.companyName ? { companyName: instruction.companyName } : {}),
  };

  if (type === 'vector') {
    const result = await vectorSearchArticles({ prompt: query, size: 15 });
    return { articles: filterVectorResults(result.articles), cascadeStep: 'vector-only' };
  }

  if (type === 'both') {
    // Run articles and vector in parallel
    const [articlesResult, vectorResult] = await Promise.allSettled([
      searchArticlesAll({
        q: query,
        sourceGroup: ['top100'],
        excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
        showReprints: false,
        sortBy: 'relevance',
        size: 15,
        from: daysAgo(5),
        language: ['en'],
        medium: ['Article'],
        ...taxonomyFilters,
      }),
      vectorSearchArticles({ prompt: vectorQuery || query, size: 15 }),
    ]);

    const articles: PerigonArticle[] = [];
    if (articlesResult.status === 'fulfilled') articles.push(...articlesResult.value.articles);
    if (vectorResult.status === 'fulfilled') articles.push(...filterVectorResults(vectorResult.value.articles));

    // Deduplicate, preferring articles/all results (listed first, have richer metadata)
    return { articles: deduplicateArticles(articles), cascadeStep: 'both-parallel' };
  }

  // type === 'articles': cascade fallback

  // Step 0 (broad topics only): try stories endpoint for pre-clustered results
  if (instruction.useStories) {
    try {
      const stories = await searchStories({
        q: query,
        size: 8,
        from: daysAgo(5),
        sourceGroup: ['top100'],
        sortBy: 'updatedAt',
        language: ['en'],
        ...(instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}),
        ...(instruction.perigonTopic ? { topic: [instruction.perigonTopic] } : {}),
        minUniqueSources: 3,
      });

      if (stories.results && stories.results.length >= 3) {
        // Extract the first (best) article from each story cluster
        const storyArticles: PerigonArticle[] = [];
        for (const story of stories.results) {
          if (story.articles && story.articles.length > 0) {
            storyArticles.push(story.articles[0]);
          }
        }
        if (storyArticles.length >= 3) {
          console.log(`📰 Stories endpoint returned ${storyArticles.length} clustered articles for "${query}"`);
          return { articles: storyArticles, cascadeStep: 'stories-clustered' };
        }
      }
      console.log(`📉 Stories returned ${stories.results?.length ?? 0} results for "${query}", falling through to articles...`);
    } catch (err) {
      console.warn(`⚠️ Stories endpoint failed for "${query}", falling through:`, err);
    }
  }

  // Step 1: top100 sources, 5-day window
  const step1 = await searchArticlesAll({
    q: query,
    sourceGroup: ['top100'],
    excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
    showReprints: false,
    sortBy: 'relevance',
    size: 20,
    from: daysAgo(5),
    language: ['en'],
    medium: ['Article'],
    ...taxonomyFilters,
  });

  if (step1.articles.length >= 3) {
    return { articles: step1.articles, cascadeStep: 'step1-top100-5d' };
  }
  console.log(`📉 Step 1 returned ${step1.articles.length} articles for "${query}", broadening...`);

  // Step 2: drop sourceGroup, extend to 7 days
  const step2 = await searchArticlesAll({
    q: query,
    excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
    showReprints: false,
    sortBy: 'relevance',
    size: 20,
    from: daysAgo(7),
    sourceGroup: [], // empty = no filter
    language: ['en'],
    medium: ['Article'],
    ...taxonomyFilters,
  });

  if (step2.articles.length >= 3) {
    return { articles: step2.articles, cascadeStep: 'step2-allsources-7d' };
  }
  console.log(`📉 Step 2 returned ${step2.articles.length} articles for "${query}", falling back to vector...`);

  // Step 3: vector search as last resort
  const step3 = await vectorSearchArticles({ prompt: query, size: 15 });
  return { articles: filterVectorResults(step3.articles), cascadeStep: 'step3-vector-fallback' };
}

// ─── Fetch articles for a single QueryInstruction (with caching) ─────

interface FetchQueryResult {
  articles: PerigonArticle[];
  cascadeStep: string;
}

async function fetchQueryArticles(instruction: QueryInstruction): Promise<FetchQueryResult> {
  const cacheType = instruction.type;
  const cacheQuery = instruction.query;

  // Check cache
  const cached = await getCachedQueryArticles(cacheType, cacheQuery);
  if (cached) {
    console.log(`📦 Cache hit for query "${cacheQuery}" (${cacheType})`);
    return { articles: cached.data.articles, cascadeStep: 'cached' };
  }

  // Execute query with cascade fallback
  const { articles, cascadeStep } = await executeQuery(instruction);

  // Cache the result
  const result: PerigonResult = {
    data: { status: 200, numResults: articles.length, articles },
  };
  await setCachedQueryArticles(cacheType, cacheQuery, result);

  return { articles, cascadeStep };
}

// ─── Fetch & merge all queries for a topic ───────────────────────────

interface TopicFetchResult {
  articles: PreparedArticle[];
  debugInfo: DebugInfo;
}

async function fetchArticlesForTopic(resolved: ResolvedTopic): Promise<TopicFetchResult> {
  // Fetch all queries in parallel
  const queryResults = await Promise.all(
    resolved.queries.map(q => fetchQueryArticles(q))
  );

  // Collect debug info
  const debugQueries: DebugQueryInfo[] = resolved.queries.map(q => ({
    type: q.type,
    query: q.query,
    vectorQuery: q.vectorQuery,
  }));
  const cascadeSteps = queryResults.map(r => r.cascadeStep);

  // Interleave results from multiple queries for balanced coverage
  const rawArticles = queryResults.map(r => r.articles);
  const interleaved = interleaveArticles(rawArticles);

  // Deduplicate and take top 12 (more material for LLM assembly)
  const deduped = deduplicateArticles(interleaved);
  const top = deduped.slice(0, 12);

  return {
    articles: prepareArticles(top, 12),
    debugInfo: {
      queries: debugQueries,
      articleCount: top.length,
      cascadeStep: cascadeSteps.join(', '),
    },
  };
}

// ─── GPT-5-nano briefing assembly ────────────────────────────────────

function parseJSONResponse(text: string): { summary: string; stories: StoryCard[] } {
  const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleanText.indexOf('{');
  const jsonEnd = cleanText.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1));
  }
  return { summary: text.substring(0, 500), stories: [] };
}

async function assembleWithLLM(
  topicName: string,
  articles: PreparedArticle[],
  settings: BriefingSettings,
): Promise<{ summary: string; stories: StoryCard[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();
  const systemPrompt = buildPerigonAssemblyPrompt(topicName, settings);
  const userMessage = buildPerigonUserMessage(topicName, articles);

  async function callLLM(): Promise<{ summary: string; stories: StoryCard[] }> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI API error (${res.status}): ${body}`);
    }

    const data = await res.json();

    if (data.usage) {
      console.log(`📊 [Perigon→LLM] Token usage — input: ${data.usage.prompt_tokens}, output: ${data.usage.completion_tokens}`);
    }

    const outputText: string = data.choices?.[0]?.message?.content ?? '';
    if (!outputText) throw new Error('No output from OpenAI');

    return parseJSONResponse(outputText);
  }

  // Try once, retry on parse failure
  try {
    return await callLLM();
  } catch (firstErr) {
    console.warn(`⚠️ First LLM assembly attempt failed for "${topicName}":`, firstErr);
    try {
      return await callLLM();
    } catch (retryErr) {
      console.error(`❌ Retry also failed for "${topicName}":`, retryErr);
      throw retryErr;
    }
  }
}

// ─── Main pipeline ──────────────────────────────────────────────────

export async function generateBriefing(
  topics: { id?: string; name: string; emoji?: string }[],
  settings: GenerateSettings,
): Promise<BriefingResponse> {
  const model = getOpenAIModel();
  const briefingSettings: BriefingSettings = {
    briefingLength: settings.briefingLength || 'medium',
    tone: settings.tone || 'professional',
  };

  // 1. Resolve all topics via query planner
  const resolved = await resolveTopics(topics);

  // 2. Fetch articles for ALL topics in parallel
  const articleResults = await Promise.allSettled(
    resolved.map(r => fetchArticlesForTopic(r))
  );

  // Build debug info from resolved topics (available even when briefing is cached)
  const debugInfoByIndex: (DebugInfo | undefined)[] = topics.map((_, i) => {
    const r = resolved[i];
    if (!r) return undefined;
    const fetchResult = articleResults[i];
    const cascadeStep = fetchResult?.status === 'fulfilled' ? fetchResult.value.debugInfo.cascadeStep : undefined;
    const articleCount = fetchResult?.status === 'fulfilled' ? fetchResult.value.debugInfo.articleCount : 0;
    return {
      queries: r.queries.map(q => ({ type: q.type, query: q.query, vectorQuery: q.vectorQuery })),
      articleCount: articleCount ?? 0,
      cascadeStep,
    };
  });

  // 3. Assemble ALL briefings with LLM in parallel
  const assemblyTasks = topics.map(async (original, i) => {
    const topicDebugInfo = debugInfoByIndex[i];
    const sectionCacheId = original.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const cachedSection = await getCachedSection(sectionCacheId);
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
      const assembled = await assembleWithLLM(original.name, articles, briefingSettings);
      const filteredStories = filterRecentStories(assembled.stories || []);
      const frontendArticles = toFrontendArticles(articles);

      return {
        topic: original.name,
        emoji: original.emoji || '',
        summary: assembled.summary || '',
        stories: filteredStories,
        articles: settings.includeLinks !== false ? frontendArticles.slice(0, 5) : [],
        generatedAt: new Date().toISOString(),
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

// ─── Simplified wrapper for cron jobs (takes topic name strings) ─────

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
