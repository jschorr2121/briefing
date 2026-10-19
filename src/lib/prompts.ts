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

export function buildAssemblyPrompt(topicName: string, settings?: BriefingSettings): string {
  const s = settings || DEFAULT_SETTINGS;
  const storyCount = { short: '3', medium: '4-5', long: '5-6' };
  const bulletsPerStory = { short: '2-3', medium: '3-4', long: '4-5' };
  const toneGuide = {
    casual: 'conversational and engaging, like a smart friend',
    professional: 'clear and informative, like a quality newsletter',
    technical: 'detailed and precise, with technical context',
  };
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `You are a news briefing writer. Today is ${today}. Given a set of recent news articles about the user topic "${topicName}", write a concise, informative briefing section.

Rules:
- Articles are pre-filtered for relevance. Prefer the most recent and most consequential stories; lead with the most important one.
- Cover ${storyCount[s.briefingLength]} DISTINCT stories (never two entries for the same event). If several articles cover one event, synthesize them into one story and link the best source.
- Skip articles that are product listings, deals, coupons, evergreen explainers, or obviously low-quality sites. If fewer good articles exist than the target count, write fewer stories rather than padding.
- If articles span sub-topics (e.g. "AI & Tech"), weave them into one coherent briefing.
- Each story: a punchy headline (max 15 words) and ${bulletsPerStory[s.briefingLength]} bullets of concrete facts (who, what, numbers, dates).
- "source" is the publication's proper name (e.g. "The Guardian", "Yahoo Finance", "Speedcubers Digest") derived from the article's site; "url" and "date" are copied exactly from the provided article — never fabricate.
- Dates as "Mon DD, YYYY".
- "summary": 2-3 sentences on the overall state of this topic area, citing specifics.
- Tone: ${toneGuide[s.tone]}

Respond with ONLY valid JSON:
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
    ? `\n\nThese article URLs were already covered in this topic's recent briefings. Prefer stories NOT in this list; only repeat one if there is a significant new development. If every provided article was recently covered, cover the most important ones anyway rather than returning nothing:\n${recentlyCoveredUrls.join('\n')}`
    : '';

  return `Topic: ${topicName}

Articles:
${JSON.stringify(articles)}${seenBlock}`;
}
