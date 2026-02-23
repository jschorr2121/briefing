import { resolveTopicToConfig, type TopicConfig } from './topic-engine';
import { searchArticles, vectorSearchArticles, type PerigonArticle } from './perigon';
import { getCachedArticles, setCachedArticles, getCachedSection, type PerigonResult } from './perigon-cache';
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

/** Convert Perigon articles to PreparedArticles for the LLM prompt */
function prepareArticles(rawArticles: PerigonArticle[], limit: number): PreparedArticle[] {
  return rawArticles.slice(0, limit).map(a => ({
    title: a.title,
    source: a.source?.name || a.source?.domain || 'Unknown',
    date: formatDate(a.pubDate),
    summary: a.summary || a.description || '',
    url: a.url,
  }));
}

/** Convert PreparedArticles to the frontend Article type */
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

// ─── Fetch articles for a single topic ───────────────────────────────

async function fetchArticlesForTopic(config: TopicConfig): Promise<{ prepared: PreparedArticle[]; result: PerigonResult } | null> {
  // Check cache first
  const cached = await getCachedArticles(config.id);
  if (cached) {
    console.log(`📦 Cache hit for "${config.displayName}"`);
    return { prepared: prepareArticles(cached.data.articles, 8), result: cached };
  }

  console.log(`🔍 Fetching from Perigon for "${config.displayName}" (strategy: ${config.queryStrategy})`);

  if (config.queryStrategy === 'stories') {
    // "stories" strategy uses Perigon taxonomy tags (GET /v1/all)
    const data = await searchArticles({
      topic: config.perigonTopic,
      category: config.perigonCategory,
      q: (!config.perigonTopic && !config.perigonCategory) ? config.keywordQuery : undefined,
      size: 10,
      sortBy: 'date',
    });
    const result: PerigonResult = { data };
    await setCachedArticles(config.id, result);
    return { prepared: prepareArticles(data.articles, 8), result };
  } else {
    // "vector" strategy uses semantic search (POST /v1/vector/news/all)
    const data = await vectorSearchArticles({
      prompt: config.vectorPrompt || config.keywordQuery,
      size: 10,
    });
    const result: PerigonResult = { data };
    await setCachedArticles(config.id, result);
    return { prepared: prepareArticles(data.articles, 8), result };
  }
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
  const systemPrompt = buildPerigonAssemblyPrompt(settings);
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

  // 1. Resolve all topics to TopicConfigs
  const topicEntries = topics.map(t => ({
    original: t,
    config: resolveTopicToConfig(t),
  }));

  // 2. Fetch articles for ALL topics in parallel
  const fetchResults = await Promise.allSettled(
    topicEntries.map(async ({ config }) => {
      return fetchArticlesForTopic(config);
    }),
  );

  // 3. Assemble briefings for each topic that has articles
  const briefings: Briefing[] = [];

  for (let i = 0; i < topicEntries.length; i++) {
    const { original, config } = topicEntries[i];
    const fetchResult = fetchResults[i];

    if (fetchResult.status === 'rejected') {
      console.error(`❌ Perigon fetch failed for "${config.displayName}":`, fetchResult.reason);
      continue;
    }

    const articleData = fetchResult.value;
    if (!articleData || articleData.prepared.length === 0) {
      console.warn(`⚠️ No articles found for "${config.displayName}", skipping`);
      continue;
    }

    // Check for pre-generated cached section first
    const cachedSection = await getCachedSection(config.id);
    if (cachedSection) {
      console.log(`📦 Using cached briefing section for "${config.displayName}"`);
      briefings.push({
        topic: original.name,
        emoji: original.emoji || '',
        summary: cachedSection.summary,
        stories: filterRecentStories(cachedSection.stories),
        articles: settings.includeLinks !== false ? cachedSection.articles.slice(0, 5) : [],
        generatedAt: cachedSection.generatedAt,
        model,
      });
      continue;
    }

    // Assemble with GPT-5-nano
    try {
      console.log(`🤖 Assembling briefing for "${config.displayName}" with ${articleData.prepared.length} articles...`);
      const assembled = await assembleWithLLM(config.displayName, articleData.prepared, briefingSettings);

      const filteredStories = filterRecentStories(assembled.stories || []);
      const frontendArticles = toFrontendArticles(articleData.prepared);

      briefings.push({
        topic: original.name,
        emoji: original.emoji || '',
        summary: assembled.summary || '',
        stories: filteredStories,
        articles: settings.includeLinks !== false ? frontendArticles.slice(0, 5) : [],
        generatedAt: new Date().toISOString(),
        model,
      });
    } catch (err) {
      console.error(`❌ LLM assembly failed for "${config.displayName}":`, err);
      // Still provide something using Perigon data directly
      briefings.push({
        topic: original.name,
        emoji: original.emoji || '',
        summary: `Latest news about ${config.displayName}.`,
        stories: [],
        articles: settings.includeLinks !== false ? toFrontendArticles(articleData.prepared).slice(0, 5) : [],
        generatedAt: new Date().toISOString(),
        model,
      });
    }
  }

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
