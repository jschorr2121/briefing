// LLM assembly of a briefing section from pre-fetched articles, plus the
// per-topic section cache and issue-over-issue freshness memory.

import { getAssemblyModel } from './models';
import { buildAssemblyPrompt, buildAssemblyUserMessage, type BriefingSettings, type PreparedArticle } from './prompts';
import { filterRecentStories } from './filter-stories';
import { getCached, setCached } from './news/cache';
import { setCachedSection, type TopicBriefingSection } from './briefing-cache';

// URLs a topic covered recently, so the next issue leads with what's new.
// Soft signal only — sparse niche topics are never left empty.
const SEEN_TTL_SECONDS = 72 * 60 * 60;
const SEEN_MAX_URLS = 30;
const seenKey = (topicId: string) => `briefing:seen:${topicId}`;

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

/** Stable cache id for a topic name: "AI & Tech" → "ai_tech". */
export function sectionCacheId(topicName: string): string {
  return topicName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseJSONResponse(text: string): { summary: string; stories: StoryCard[] } {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(clean.substring(start, end + 1));
  throw new Error('No JSON object in assembly output');
}

function toFrontendArticles(prepared: PreparedArticle[]): Article[] {
  const seen = new Set<string>();
  return prepared
    .filter(a => (seen.has(a.url) ? false : (seen.add(a.url), true)))
    .map(a => ({ title: a.title, source: a.source, url: a.url, snippet: a.summary?.substring(0, 150) || undefined }));
}

async function callLLM(system: string, user: string): Promise<{ summary: string; stories: StoryCard[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: getAssemblyModel(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  if (data.usage) {
    console.log(`📊 [Assembly] ${data.model} — input: ${data.usage.prompt_tokens}, output: ${data.usage.completion_tokens}`);
  }
  const text: string = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('No output from OpenAI');
  return parseJSONResponse(text);
}

/**
 * Assemble a briefing section for one topic from gathered articles.
 * Drops stale/future-dated stories, keeps only URLs that were actually
 * provided, and writes the section cache + seen-URL memory on success.
 */
export async function assembleSection(
  topicName: string,
  articles: PreparedArticle[],
  settings: BriefingSettings,
): Promise<TopicBriefingSection> {
  const cacheId = sectionCacheId(topicName);
  const recentlyCovered = (await getCached<string[]>(seenKey(cacheId))) ?? [];
  const system = buildAssemblyPrompt(topicName, settings);
  const user = buildAssemblyUserMessage(topicName, articles, recentlyCovered);

  let assembled: { summary: string; stories: StoryCard[] };
  try {
    assembled = await callLLM(system, user);
  } catch (firstErr) {
    console.warn(`⚠️ First assembly attempt failed for "${topicName}":`, firstErr);
    assembled = await callLLM(system, user);
  }

  // Fabricated-URL defense in code, not prompt: a story may only link a URL we gave it.
  const known = new Set(articles.map(a => a.url));
  const stories = filterRecentStories(
    (assembled.stories || []).map(s => (s.url && known.has(s.url) ? s : { ...s, url: undefined }))
  );

  const section: TopicBriefingSection = {
    topic: topicName,
    summary: assembled.summary || '',
    stories,
    articles: toFrontendArticles(articles),
    generatedAt: new Date().toISOString(),
  };

  await setCachedSection(cacheId, section);

  const coveredNow = stories.map(s => s.url).filter((u): u is string => !!u);
  if (coveredNow.length > 0) {
    const merged = [...coveredNow, ...recentlyCovered.filter(u => !coveredNow.includes(u))].slice(0, SEEN_MAX_URLS);
    await setCached(seenKey(cacheId), merged, SEEN_TTL_SECONDS);
  }
  return section;
}
