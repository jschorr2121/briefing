import { resolveTopics, type QueryInstruction, type ResolvedTopic } from './query-planner';
import { searchArticlesAll, vectorSearchArticles, type PerigonArticle } from './perigon';
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

interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  stories: StoryCard[];
  articles: Article[];
  generatedAt: string;
  model: string;
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

// ─── Cascade fallback for a single QueryInstruction ──────────────────

async function executeQuery(instruction: QueryInstruction): Promise<PerigonArticle[]> {
  const { type, query, vectorQuery } = instruction;

  if (type === 'vector') {
    const result = await vectorSearchArticles({ prompt: query, size: 10 });
    return result.articles;
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
        size: 10,
        from: daysAgo(3),
        language: ['en'],
        medium: ['Article'],
      }),
      vectorSearchArticles({ prompt: vectorQuery || query, size: 10 }),
    ]);

    const articles: PerigonArticle[] = [];
    if (articlesResult.status === 'fulfilled') articles.push(...articlesResult.value.articles);
    if (vectorResult.status === 'fulfilled') articles.push(...vectorResult.value.articles);

    // Deduplicate, preferring articles/all results (listed first, have richer metadata)
    return deduplicateArticles(articles);
  }

  // type === 'articles': cascade fallback
  // Step 1: top100 sources, 3-day window
  const step1 = await searchArticlesAll({
    q: query,
    sourceGroup: ['top100'],
    excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
    showReprints: false,
    sortBy: 'relevance',
    size: 15,
    from: daysAgo(3),
    language: ['en'],
    medium: ['Article'],
  });

  if (step1.articles.length >= 3) {
    return step1.articles;
  }
  console.log(`📉 Step 1 returned ${step1.articles.length} articles for "${query}", broadening...`);

  // Step 2: drop sourceGroup, extend to 7 days
  const step2 = await searchArticlesAll({
    q: query,
    excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
    showReprints: false,
    sortBy: 'relevance',
    size: 15,
    from: daysAgo(7),
    sourceGroup: [], // empty = no filter
    language: ['en'],
    medium: ['Article'],
  });

  if (step2.articles.length >= 3) {
    return step2.articles;
  }
  console.log(`📉 Step 2 returned ${step2.articles.length} articles for "${query}", falling back to vector...`);

  // Step 3: vector search as last resort
  const step3 = await vectorSearchArticles({ prompt: query, size: 10 });
  return step3.articles;
}

// ─── Fetch articles for a single QueryInstruction (with caching) ─────

async function fetchQueryArticles(instruction: QueryInstruction): Promise<PerigonArticle[]> {
  const cacheType = instruction.type;
  const cacheQuery = instruction.query;

  // Check cache
  const cached = await getCachedQueryArticles(cacheType, cacheQuery);
  if (cached) {
    console.log(`📦 Cache hit for query "${cacheQuery}" (${cacheType})`);
    return cached.data.articles;
  }

  // Execute query with cascade fallback
  const articles = await executeQuery(instruction);

  // Cache the result
  const result: PerigonResult = {
    data: { status: 200, numResults: articles.length, articles },
  };
  await setCachedQueryArticles(cacheType, cacheQuery, result);

  return articles;
}

// ─── Fetch & merge all queries for a topic ───────────────────────────

async function fetchArticlesForTopic(resolved: ResolvedTopic): Promise<PreparedArticle[]> {
  // Fetch all queries in parallel
  const queryResults = await Promise.all(
    resolved.queries.map(q => fetchQueryArticles(q))
  );

  // Interleave results from multiple queries for balanced coverage
  const interleaved = interleaveArticles(queryResults);

  // Deduplicate and take top 10
  const deduped = deduplicateArticles(interleaved);
  const top = deduped.slice(0, 10);

  return prepareArticles(top, 10);
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

  // 3. Assemble ALL briefings with LLM in parallel
  const assemblyTasks = topics.map(async (original, i) => {
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
      } as Briefing;
    }

    const articleResult = articleResults[i];
    if (articleResult.status === 'rejected') {
      console.error(`❌ Article fetch failed for "${original.name}":`, articleResult.reason);
      return null;
    }

    const articles = articleResult.value;
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
