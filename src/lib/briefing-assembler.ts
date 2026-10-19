// LLM assembly of a briefing section from pre-fetched articles, plus the
// per-topic section cache and issue-over-issue freshness memory.

import { getAssemblyModel, getPlannerModel } from './models';
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

/** Recover a story whose URL the model altered: best title-overlap article, if strong. */
function recoverArticle(s: StoryCard, known: Map<string, PreparedArticle>): PreparedArticle | undefined {
  if (s.url && known.has(s.url)) return known.get(s.url);
  const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const h = words(s.headline || '');
  if (h.size === 0) return undefined;
  let best: PreparedArticle | undefined;
  let bestScore = 0;
  for (const a of known.values()) {
    const t = words(a.title);
    let overlap = 0;
    for (const w of h) if (t.has(w)) overlap++;
    const score = overlap / Math.min(h.size, Math.max(t.size, 1));
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 0.5 ? best : undefined;
}

function sanitizeStory(s: StoryCard, known: Map<string, PreparedArticle>): StoryCard {
  const article = recoverArticle(s, known);
  const bullets = (s.bullets || []).map(b => (typeof b === 'string' ? cleanBullet(b) : null)).filter((b): b is string => !!b);
  const headline = (s.headline || '').replace(OUTLET_PREFIX, '').trim();
  return {
    ...s,
    headline,
    bullets,
    url: article?.url,
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

// ─── Verification pass ───────────────────────────────────────────────
// The Oct 19 round-5 review caught "Antonelli won the Singapore Grand Prix"
// (he was third) and two cards for one event. One cheap judge call per topic
// checks each bullet against the cited article's text, flags unsupported
// headlines, and flags cards that repeat an earlier card's event.

interface Verdict {
  stories: { index: number; drop?: boolean; contradiction?: boolean; duplicate?: boolean; reason?: string; badBullets?: number[] }[];
}
// Below this much article text the judge only saw a snippet: act on explicit
// contradictions and duplicates, never on "not mentioned" (round-6: NBA fell
// to one story because roundup pages had no fetched text).
const SNIPPET_ONLY_CHARS = 600;

function buildVerifyPrompt(): string {
  return `You are a fact-checker for a news briefing. You get stories (headline + bullets) and, for each, the text of the article it cites.

For each story decide:
- "duplicate": true if the story is the same EVENT as an EARLIER story in the list (same announcement, same game, same market move). Two different events that happen to cite the same roundup article are NOT duplicates.
- "contradiction": true if the headline or any bullet states something the article text CONTRADICTS (wrong winner, wrong number, wrong actor).
- "drop": true if duplicate, or if the HEADLINE is contradicted or not supported by the article text, or if the article text is clearly about a different subject than the headline.
- "badBullets": 0-based indexes of bullets that state a specific fact (number, name, outcome, quote, date) that the article text does not support or contradicts. A bullet that merely summarizes or paraphrases supported content is fine. Minor wording differences are fine. If the article text is empty or just a short snippet, only flag a bullet when it contradicts that snippet.
- "reason": a few words.

Be strict about contradictions and invented specifics, lenient about paraphrase. Respond with ONLY JSON:
{"stories": [{"index": 0, "duplicate": false, "contradiction": false, "drop": false, "badBullets": [], "reason": "..."}, ...]}`;
}

async function verifyStories(stories: StoryCard[], known: Map<string, PreparedArticle>): Promise<StoryCard[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || stories.length === 0) return stories;
  const payload = stories.map((s, index) => {
    const a = s.url ? known.get(s.url) : undefined;
    return { index, headline: s.headline, bullets: s.bullets, articleTitle: a?.title ?? '', articleText: (a?.summary ?? '').slice(0, 2500) };
  });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: getPlannerModel(),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildVerifyPrompt() },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`verify HTTP ${res.status}`);
    const data = await res.json();
    const verdict = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Verdict;
    if (!Array.isArray(verdict.stories)) return stories;
    const byIndex = new Map(verdict.stories.map(v => [v.index, v]));
    const out: StoryCard[] = [];
    stories.forEach((s, i) => {
      const v = byIndex.get(i);
      const snippetOnly = (payload[i].articleText || '').length < SNIPPET_ONLY_CHARS;
      const actionable = !snippetOnly || v?.contradiction || v?.duplicate;
      if (v?.drop && actionable) {
        console.log(`🧐 [Verify] Dropped "${s.headline}" — ${v.reason ?? 'unsupported or duplicate'}`);
        return;
      }
      const bad = new Set(actionable ? v?.badBullets ?? [] : []);
      const bullets = s.bullets.filter((_, bi) => !bad.has(bi));
      if (bad.size > 0) console.log(`🧐 [Verify] Removed ${bad.size} unsupported bullet(s) from "${s.headline}"`);
      if (bullets.length > 0) out.push({ ...s, bullets });
    });
    return out;
  } catch (err) {
    console.warn('⚠️ [Verify] Fact-check failed, keeping stories as written:', err);
    return stories;
  }
}

const MIN_STORIES = 2;

/** After the verifier removes stories, the summary must not still refer to them. */
async function rewriteSummary(topicName: string, summary: string, stories: StoryCard[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !summary || stories.length === 0) return summary;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: getPlannerModel(),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `Edit a briefing summary for the topic "${topicName}" so it refers ONLY to the stories listed. Remove sentences about anything else; keep the length, tone and facts otherwise unchanged. Respond with ONLY {"summary": "..."}.` },
          { role: 'user', content: JSON.stringify({ summary, stories: stories.map(s => ({ headline: s.headline, bullets: s.bullets })) }) },
        ],
      }),
    });
    if (!res.ok) return summary;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    return typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : summary;
  } catch {
    return summary;
  }
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
  const clean = (raw: StoryCard[]) =>
    filterRecentStories(raw.map(s => sanitizeStory(s, known)).filter(s => s.headline && s.bullets.length > 0 && s.url));

  const written = clean(assembled.stories || []);
  let stories = await verifyStories(written, known);
  let summary = assembled.summary || '';
  if (stories.length < written.length) summary = await rewriteSummary(topicName, summary, stories);

  // Story floor: the writer sometimes over-skips (round-5 review: "Health
  // collapsed to ONE story" with 8 articles available). One retry that names
  // what it already wrote and asks for the next most newsworthy events.
  if (stories.length < MIN_STORIES && articles.length >= MIN_STORIES + 1) {
    console.log(`🔁 [Assembly] Only ${stories.length} story for "${topicName}" from ${articles.length} articles — asking for more`);
    try {
      const retry = await callLLM(
        system,
        `${user}\n\nYou previously returned only ${stories.length} story (${stories.map(s => s.headline).join(' | ') || 'none'}). The reader needs at least ${MIN_STORIES + 1}. Keep those and add the next most newsworthy DISTINCT events from the articles, applying the same standards. Return the full list.`,
      );
      const retryWritten = clean(retry.stories || []);
      const more = await verifyStories(retryWritten, known);
      if (more.length > stories.length) {
        stories = more;
        summary = retry.summary || summary;
        if (more.length < retryWritten.length) summary = await rewriteSummary(topicName, summary, stories);
      }
    } catch (err) {
      console.warn(`⚠️ [Assembly] Retry failed for "${topicName}":`, err);
    }
  }

  const section: TopicBriefingSection = {
    topic: topicName,
    summary,
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
