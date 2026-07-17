/**
 * briefing-pipeline.ts
 *
 * Single entry point for briefing generation. Reads NEWS_SOURCE and delegates
 * to either the Perigon pipeline (default) or the legacy OpenAI/Perplexity path.
 *
 * Both API routes (`/api/generate` and `/api/cron/generate-briefs`) call this
 * module instead of embedding their own pipeline-selection logic.
 */

import { getGenerationModel, getOpenAIModel } from './models';
import { filterRecentStories } from './filter-stories';
import { buildSystemPrompt, buildUserMessage } from './prompts';
import {
  generateBriefing as generateBriefingPerigon,
  generateBriefingsForCron,
  type BriefingResponse,
} from './briefing-generator';

// NEWS_SOURCE values:
//   perigon (default) — Perigon article pipeline
//   agentic           — LLM web-search gathering (agentic-fetcher.ts) + same assembly
//   openai/perplexity — legacy single-call paths (kept for revert capability)
const NEWS_SOURCE = process.env.NEWS_SOURCE || 'perigon';
const MODERN_SOURCES = ['perigon', 'agentic'];

// ─── Shared types ────────────────────────────────────────────────────

export interface TopicInput {
  id?: string;
  name: string;
  emoji?: string;
}

export interface BriefingSettings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks?: boolean;
  tone: 'casual' | 'professional' | 'technical';
  skipCache?: boolean;
}

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

// ─── Internal helpers ────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i + 1) * 1000;
        const clampedWait = Math.min(waitTime, 30000);
        const errorBody = await response.text().catch(() => 'unable to read body');
        console.warn(`⚠️ Rate limited (429) on attempt ${i + 1}/${maxRetries}. Body: ${errorBody}. Retry-After: ${retryAfter}. Waiting ${clampedWait}ms...`);
        if (i < maxRetries - 1) {
          await delay(clampedWait);
          continue;
        }
        throw new Error(`Rate limited after ${maxRetries} retries. Last response: ${errorBody}`);
      }
      if (!response.ok && response.status >= 500) {
        const errorBody = await response.text().catch(() => '');
        console.warn(`⚠️ Server error (${response.status}) on attempt ${i + 1}/${maxRetries}: ${errorBody}`);
        lastError = new Error(`API error ${response.status}: ${errorBody}`);
        if (i < maxRetries - 1) await delay(Math.pow(2, i + 1) * 1000);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Fetch error on attempt ${i + 1}/${maxRetries}: ${lastError.message}`);
      if (i < maxRetries - 1) await delay(Math.pow(2, i + 1) * 1000);
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

function parseJSONResponse(text: string): { summary: string; stories: StoryCard[] } {
  const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleanText.indexOf('{');
  const jsonEnd = cleanText.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1));
  }
  return { summary: text.substring(0, 500), stories: [] };
}

// ─── Legacy: OpenAI Web Search ───────────────────────────────────────

async function fetchFromOpenAI(
  topic: string,
  settings: BriefingSettings
): Promise<{ summary: string; stories: StoryCard[]; articles: Article[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();
  console.log(`[Legacy] Using OpenAI model: ${model}`);

  const userMessage = buildUserMessage(topic, { settings });

  const response = await fetchWithRetry('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: buildSystemPrompt(),
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
      tool_choice: 'auto',
      input: userMessage,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.usage) {
    console.log(`📊 Token usage — input: ${data.usage.input_tokens}, output: ${data.usage.output_tokens}, cached: ${data.usage.input_tokens_details?.cached_tokens ?? 'N/A'}`);
  }

  let outputText = data.output_text || '';

  if (!outputText && data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text' || content.type === 'text') {
            outputText = content.text;
            break;
          }
        }
      }
    }
  }

  if (!outputText) throw new Error('No output from OpenAI');

  const articles: Article[] = [];
  if (data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.annotations) {
            for (const annotation of content.annotations) {
              if (annotation.type === 'url_citation') {
                articles.push({
                  title: annotation.title || 'News Article',
                  source: new URL(annotation.url).hostname.replace('www.', ''),
                  url: annotation.url,
                });
              }
            }
          }
        }
      }
    }
  }

  const parsed = parseJSONResponse(outputText);
  if (!parsed.stories || parsed.stories.length === 0) {
    console.warn(`⚠️ No stories parsed for topic. Raw output (first 500 chars): ${outputText.substring(0, 500)}`);
  } else {
    console.log(`📰 Parsed ${parsed.stories.length} stories. Dates: ${parsed.stories.map(s => s.date || 'none').join(', ')}`);
  }
  const filteredStories = filterRecentStories(parsed.stories || []);
  if (filteredStories.length < (parsed.stories || []).length) {
    console.warn(`⚠️ Filtered ${(parsed.stories || []).length - filteredStories.length} stories, ${filteredStories.length} remaining`);
  }
  const seen = new Set<string>();
  const uniqueArticles = articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  return {
    summary: parsed.summary || outputText.substring(0, 300),
    stories: filteredStories,
    articles: uniqueArticles.slice(0, 8),
  };
}

// ─── Legacy: Perplexity Search ───────────────────────────────────────

async function fetchFromPerplexity(
  topic: string,
  settings: BriefingSettings
): Promise<{ summary: string; stories: StoryCard[]; articles: Article[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const userMessage = buildUserMessage(topic, { settings });

  const response = await fetchWithRetry('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity API error:', response.status, errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content || '';

  if (!outputText) throw new Error('No output from Perplexity');

  const articles: Article[] = [];
  if (data.citations && Array.isArray(data.citations)) {
    for (const citation of data.citations) {
      try {
        const url = typeof citation === 'string' ? citation : citation?.url;
        if (url && url.startsWith('http')) {
          articles.push({
            title: typeof citation === 'object' ? (citation.title || 'News Article') : 'News Article',
            source: new URL(url).hostname.replace('www.', ''),
            url: url,
          });
        }
      } catch (e) {
        console.log('Skipping invalid citation:', citation);
      }
    }
  }

  const parsed = parseJSONResponse(outputText);
  if (!parsed.stories || parsed.stories.length === 0) {
    console.warn(`⚠️ [Perplexity] No stories parsed for topic. Raw output (first 500 chars): ${outputText.substring(0, 500)}`);
  } else {
    console.log(`📰 [Perplexity] Parsed ${parsed.stories.length} stories. Dates: ${parsed.stories.map(s => s.date || 'none').join(', ')}`);
  }
  const filteredStories = filterRecentStories(parsed.stories || []);
  if (filteredStories.length < (parsed.stories || []).length) {
    console.warn(`⚠️ [Perplexity] Filtered ${(parsed.stories || []).length - filteredStories.length} stories, ${filteredStories.length} remaining`);
  }

  return {
    summary: parsed.summary || outputText.substring(0, 300),
    stories: filteredStories,
    articles: articles.slice(0, 8),
  };
}

// ─── Legacy: single-topic briefing ──────────────────────────────────

async function generateBriefingForTopic_legacy(
  topic: TopicInput,
  settings: BriefingSettings
): Promise<Briefing> {
  const model = getGenerationModel();

  let summary: string = '';
  let stories: StoryCard[] = [];
  let articles: Article[] = [];

  console.log(`[Legacy] Generating briefing for ${topic.name} using ${model}...`);

  try {
    let result;
    if (model === 'perplexity') {
      result = await fetchFromPerplexity(topic.name, settings);
    } else {
      result = await fetchFromOpenAI(topic.name, settings);
    }
    summary = result.summary;
    stories = result.stories;
    articles = result.articles;
  } catch (error) {
    console.error(`Error generating briefing for ${topic.name}:`, error);
    summary = `Unable to generate briefing for ${topic.name} at this time.`;
  }

  return {
    topic: topic.name,
    emoji: topic.emoji || '',
    summary,
    stories,
    articles: settings.includeLinks ? articles.slice(0, 5) : [],
    generatedAt: new Date().toISOString(),
    model: String(model),
  };
}

// ─── Legacy: multi-topic loop (used by cron) ─────────────────────────

async function generateBriefings_legacy(
  topics: TopicInput[],
  settings: BriefingSettings
): Promise<Briefing[]> {
  const briefings: Briefing[] = [];
  for (const topic of topics) {
    const briefing = await generateBriefingForTopic_legacy(topic, settings);
    briefings.push(briefing);
    await delay(500);
  }
  return briefings;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate briefings for a list of topics.
 *
 * Pipeline is selected via the NEWS_SOURCE env var:
 *   - "perigon"    → Perigon article pipeline (default)
 *   - "openai"     → Legacy OpenAI Responses API with web_search
 *   - "perplexity" → Legacy Perplexity sonar model
 */
export async function generateBriefing(
  topics: TopicInput[],
  settings: BriefingSettings
): Promise<BriefingResponse> {
  if (MODERN_SOURCES.includes(NEWS_SOURCE)) {
    console.log(`🔄 Using ${NEWS_SOURCE} pipeline for ${topics.length} topics`);
    return generateBriefingPerigon(topics, settings);
  }

  console.log(`🔄 Using legacy ${NEWS_SOURCE} pipeline for ${topics.length} topics`);
  const briefings = await generateBriefings_legacy(topics, settings);
  return { briefings, model: String(getGenerationModel()) };
}

/**
 * Simplified wrapper for cron jobs: accepts topic-name strings and returns
 * the flat array expected by the cron route's CachedBriefing shape.
 */
export async function generateBriefingsForCronPipeline(
  topicNames: string[]
): Promise<{ topic: string; summary: string; stories: StoryCard[]; articles: Article[] }[]> {
  if (MODERN_SOURCES.includes(NEWS_SOURCE)) {
    console.log(`🔄 [Cron] Using ${NEWS_SOURCE} pipeline for ${topicNames.length} topics`);
    return generateBriefingsForCron(topicNames);
  }

  console.log(`🔄 [Cron] Using legacy OpenAI pipeline for ${topicNames.length} topics`);
  const defaultSettings: BriefingSettings = {
    briefingLength: 'medium',
    tone: 'professional',
    includeLinks: true,
  };
  const topicInputs: TopicInput[] = topicNames.map(name => ({ name }));
  const briefings = await generateBriefings_legacy(topicInputs, defaultSettings);
  return briefings.map(b => ({
    topic: b.topic,
    summary: b.summary,
    stories: b.stories,
    articles: b.articles,
  }));
}
