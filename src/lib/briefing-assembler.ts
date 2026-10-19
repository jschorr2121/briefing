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

// Prompt-leak and artifact guard. The Oct 19 2026 reviews found bullets like
// "source reminder: New York Times" / "date: Oct 17, 2026", headlines prefixed
// "NYT:", and week-old articles stamped with today's date. Cheap to catch here.
const LEAK_BULLET = /^\s*(source( reminder)?|url( and date)?|date|published|publication date|publish date|coverage date|announcement date|report(ed|ing) date)\s*[:：]/i;
const OUTLET_PREFIX = /^\s*[A-Z][A-Za-z0-9&.' ]{1,25}:\s+(?=[A-Z0-9'"“])/;

// "The Guardian reported that X" → "X"; "...was published Oct 19, 2026." bullets dropped.
// Only strip when the remainder is a complete clause: "… reported that X" or
// "… reports, X". Stripping "The Information described the model as …" left
// the fragment "As improving reasoning …" in the Oct 19 round-3 review.
const ATTRIBUTION_LEAD = /^(?:(?:the |an? )?[A-Z][\w.'’&-]*(?: [A-Z][\w.'’&-]*){0,3}|it|the (?:article|piece|story|report|coverage|outlet)) (?:reported|reports|said|says|noted|notes|highlighted|highlights|wrote|writes|stated|states|confirmed|confirms|added|adds)(?: that\s+|,\s+)/i;
const DATE_ONLY_BULLET = /^(?:the )?(?:report|article|piece|story|coverage|announcement|post)(?:'s)? (?:was|is) (?:published|dated|released|posted)\b|^(?:published|dated|posted|reported) (?:on )?[A-Z][a-z]{2}\.? \d/i;

export function cleanBullet(b: string): string | null {
  const t = b.trim();
  if (!t || LEAK_BULLET.test(t) || DATE_ONLY_BULLET.test(t)) return null;
  const stripped = t.replace(ATTRIBUTION_LEAD, '');
  if (stripped.length < 15) return null; // nothing left once the attribution is gone
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function sanitizeStory(s: StoryCard, known: Map<string, PreparedArticle>): StoryCard {
  const article = s.url ? known.get(s.url) : undefined;
  const bullets = (s.bullets || []).map(b => (typeof b === 'string' ? cleanBullet(b) : null)).filter((b): b is string => !!b);
  const headline = (s.headline || '').replace(OUTLET_PREFIX, '').trim();
  return {
    ...s,
    headline,
    bullets,
    url: article ? s.url : undefined,
    // The article's own date beats whatever the model wrote.
    date: article?.date || s.date,
    source: s.source || article?.source,
  };
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
  const known = new Map(articles.map(a => [a.url, a] as const));
  const stories = filterRecentStories(
    (assembled.stories || [])
      .map(s => sanitizeStory(s, known))
      .filter(s => s.headline && s.bullets.length > 0)
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
