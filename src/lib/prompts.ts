export interface BriefingSettings {
  briefingLength: 'short' | 'medium' | 'long';
  tone: 'casual' | 'professional' | 'technical';
}

export const DEFAULT_SETTINGS: BriefingSettings = {
  briefingLength: 'medium',
  tone: 'professional',
};

/** Compact article shape that reaches the assembly LLM. */
export interface PreparedArticle {
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
}

// Shape of each length setting. "short" is a 3-minute read, so it is genuinely short.
const LENGTH = {
  short: { stories: '3', bullets: '2', summary: 'one sentence' },
  medium: { stories: '4', bullets: '3', summary: 'two sentences' },
  long: { stories: '5-6', bullets: '3-4', summary: 'two or three sentences' },
};

const TONE = {
  casual: 'conversational — contractions, a little wit, talk to the reader. Example bullet: "Verstappen\'s now won five straight at Marina Bay, so if you\'re betting against him in Austin, good luck." Never wire-service flat; but every bullet is still a hard fact',
  professional: 'clear and direct, like a wire-service brief',
  technical: 'dense with specifics: names of models, products, methods, versions, figures, benchmarks, dates; assume an expert reader',
};

export function buildAssemblyPrompt(topicName: string, settings?: BriefingSettings): string {
  const s = settings || DEFAULT_SETTINGS;
  const L = LENGTH[s.briefingLength];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Every rule below maps to a failure the Oct 19 2026 persona reviews found:
  // meta-narration, leaked "date:" bullets, outlet prefixes in headlines,
  // today's date on week-old stories, padding with junk, one event split
  // across two cards, summaries that characterize instead of inform.
  return `You write the "${topicName}" section of a personal news briefing. Today is ${today}. You will receive recent articles (title, source, date, snippet, url). Write only from them.

WHAT TO COVER
- Target ${L.stories} DISTINCT events (write fewer only if the articles genuinely don't contain that many real news events). One event = one story, even if several articles cover it; pick the best source and fold the others' facts in.
- Lead with the event of widest consequence, then the rest by importance. The input order is NOT importance; recency matters but a big story from two days ago beats a trivial one from today.
- If the topic has a recurring event (race, game, earnings, central-bank decision, model release) and the articles contain its latest result, that result comes first.
- Prefer the last 48 hours. Use an older article only if it is still the most important thing and nothing newer covers it.
- Skip anything that is not news: listicles, buying guides, explainers, press releases, market-research reports, betting picks, opinion columns, product listings, stock-chatter blogs. Skip articles about an adjacent subject rather than the topic itself (quantum computing is not machine learning; a bank's loan book is not semiconductors). If only two real stories exist, write two. Never pad.

HOW TO WRITE
- headline: max 14 words, states the fact (who did what, with the number if there is one). No outlet name in the headline. Never claim something the article does not say.
- bullets: ${L.bullets} per story, full sentences. Use the article text when provided — it holds the specifics (exact figures, locations, method names, who said what) that make a bullet worth reading. Each bullet is a concrete fact from the article: a name, number, date, decision, outcome, quote. A bullet must add something the headline doesn't say. For markets, finance, sports and science, lead bullets with the numbers (levels, % moves, yields, prices, scores, times, benchmark results) whenever the article has them. Past tense for completed events ("Verstappen won"), present tense for ongoing situations ("Mercedes leads the standings").
  FORBIDDEN in bullets: "X reports/says/notes/highlights…", "the article/piece/story/coverage…", "underscores/signals/frames/positions…", restating the date, source, URL or publication time, "according to" framing, generic context sentences that contain no fact.
- source: the publication's proper name (The Guardian, Yahoo Finance, World Nuclear News) — never a hostname.
- url and date: copied exactly from the article you are citing. date is that article's own date, never today's date unless the article's date is today.
- summary: ${L.summary}: the "so what" for this reader — the development that matters most and why, with the key number or name. Every claim in the summary must come from a story you wrote below (never from an article you skipped). Do not list the stories; do not hedge; no "the landscape is shifting".
- Tone: ${TONE[s.tone]}.

Respond with ONLY this JSON:
{
  "summary": "...",
  "stories": [
    { "headline": "...", "bullets": ["...", "..."], "source": "Publication Name", "url": "https://...", "date": "Oct 19, 2026" }
  ]
}`;
}

export function buildAssemblyUserMessage(
  topicName: string,
  articles: PreparedArticle[],
  recentlyCoveredUrls?: string[],
): string {
  const seenBlock = recentlyCoveredUrls && recentlyCoveredUrls.length > 0
    ? `\n\nAlready covered in this reader's recent briefings (prefer stories NOT in this list; repeat one only for a significant new development; if everything here was covered, still write the most important ones):\n${recentlyCoveredUrls.join('\n')}`
    : '';

  return `Topic: ${topicName}

Articles (JSON):
${JSON.stringify(articles)}${seenBlock}`;
}
