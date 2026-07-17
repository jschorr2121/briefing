// LLM assembly of a briefing section from pre-fetched articles.
//
// Extracted from briefing-generator.ts (the fetch side lives in
// article-fetcher.ts). This module owns:
//   - the LLM call that turns PreparedArticle[] into { summary, stories }
//   - recency filtering of the assembled stories
//   - the per-topic section cache (read happens in briefing-generator;
//     the write happens here after a successful assembly)
//
// The article source is irrelevant to this module — Perigon, web search,
// or anything else that produces PreparedArticle[] can feed it.

import { getOpenAIModel } from './models';
import {
  buildPerigonAssemblyPrompt,
  buildPerigonUserMessage,
  type BriefingSettings,
  type PreparedArticle,
} from './prompts';
import { filterRecentStories } from './filter-stories';
import { setCachedSection, type TopicBriefingSection } from './perigon-cache';
import { getCached, setCached } from './news/cache';

// Issue-over-issue freshness: story URLs covered in a topic's recent
// briefings, so the next issue leads with what's new instead of repeating
// yesterday. Soft signal only — the LLM may still re-cover a story on a
// significant development, and sparse niche topics are never left empty.
const SEEN_TTL_SECONDS = 72 * 60 * 60;
const SEEN_MAX_URLS = 30;

function seenKey(topicId: string): string {
  return `briefing:seen:${topicId}`;
}

// ─── Types (matching the frontend contract) ──────────────────────────

export interface Article {
  title: string;
  source: string;
  url: string;
  snippet?: string;
}

export interface StoryCard {
  headline: string;
  bullets: string[];
  source?: string;
  url?: string;
  date?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Stable cache id for a topic name: "AI & Tech" → "ai_tech". */
export function sectionCacheId(topicName: string): string {
  return topicName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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

// ─── LLM call ────────────────────────────────────────────────────────

async function assembleWithLLM(
  topicName: string,
  articles: PreparedArticle[],
  settings: BriefingSettings,
  recentlyCoveredUrls: string[],
): Promise<{ summary: string; stories: StoryCard[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();
  const systemPrompt = buildPerigonAssemblyPrompt(topicName, settings);
  const userMessage = buildPerigonUserMessage(topicName, articles, recentlyCoveredUrls);

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
      console.log(`📊 [Assembly] Token usage — input: ${data.usage.prompt_tokens}, output: ${data.usage.completion_tokens}`);
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
    return await callLLM();
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Assemble a briefing section for one topic from pre-fetched articles.
 * Filters out stale stories and writes the section cache on success.
 */
export async function assembleSection(
  topicName: string,
  articles: PreparedArticle[],
  settings: BriefingSettings,
  _skipCache = false,
): Promise<TopicBriefingSection> {
  const cacheId = sectionCacheId(topicName);
  const recentlyCovered = (await getCached<string[]>(seenKey(cacheId))) ?? [];

  const assembled = await assembleWithLLM(topicName, articles, settings, recentlyCovered);

  const section: TopicBriefingSection = {
    topic: topicName,
    summary: assembled.summary || '',
    stories: filterRecentStories(assembled.stories || []),
    articles: toFrontendArticles(articles),
    generatedAt: new Date().toISOString(),
  };

  // Write-through even in dev mode (reads are what skipCache bypasses).
  await setCachedSection(cacheId, section);

  // Remember what this issue covered so the next one leads with fresh stories.
  const coveredNow = section.stories.map(s => s.url).filter((u): u is string => !!u);
  if (coveredNow.length > 0) {
    const merged = [...coveredNow, ...recentlyCovered.filter(u => !coveredNow.includes(u))].slice(0, SEEN_MAX_URLS);
    await setCached(seenKey(cacheId), merged, SEEN_TTL_SECONDS);
  }

  return section;
}
