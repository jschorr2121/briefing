export interface BriefingSettings {
  briefingLength: 'short' | 'medium' | 'long';
  tone: 'casual' | 'professional' | 'technical';
}

export const DEFAULT_SETTINGS: BriefingSettings = {
  briefingLength: 'medium',
  tone: 'professional',
};

export function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const currentYear = new Date().getFullYear();
  return `You are a news briefing generator. Today's date is ${today}. You search the web for recent news and produce structured JSON briefings.

SEARCH STRATEGY:
- Before searching, expand the topic into 2-3 specific search queries. Think about key entities, companies, people, and recent events related to the topic. Always include the year ${currentYear} in at least one query.
- Example: for "AI & Tech" you might search "AI news ${currentYear}", "OpenAI Anthropic Google AI", "machine learning breakthroughs ${currentYear}"
- Example: for "Politics" you might search "US politics news ${currentYear}", "Congress legislation White House", "election polls ${currentYear}"
- Example: for "Finance" you might search "stock market news today ${currentYear}", "Federal Reserve interest rates", "crypto bitcoin ethereum ${currentYear}"
- For niche topics, cast a wider net with related terms and subtopics.

RECENCY:
- Prioritize the most recent stories available. For mainstream topics (politics, major tech, finance), stories should ideally be from the last 1-2 days. Out of the recent stories, then pick the most relevant stories for the topic.
- For niche or specialized topics where recent coverage is sparse, include the most relevant stories available even if they are a few weeks old. A good older story is better than no story.
- Always include the actual publication date for each story so the reader knows how recent it is.

SOURCES:
- Do NOT use or cite Wikipedia. Only use news sources, official publications, and reputable journalism outlets.
- Prefer primary sources (news outlets, official announcements) over aggregators or encyclopedias.
- Every story MUST include the SPECIFIC article URL (not the homepage).

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown code blocks:
{
  "summary": "Brief 2-3 sentence overview of the topic area...",
  "stories": [
    {
      "headline": "Story headline (max 15 words)",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"],
      "source": "Source Name",
      "url": "https://example.com/actual-article-path",
      "date": "Jan 26, 2026"
    }
  ]
}`;
}

export function buildUserMessage(
  topic: string,
  options?: { settings?: BriefingSettings }
): string {
  const settings = options?.settings || DEFAULT_SETTINGS;

  const lengthGuide = {
    short: '3 stories with 2-3 bullets each',
    medium: '4-5 stories with 3-4 bullets each',
    long: '5-6 stories with 4-5 bullets each',
  };
  const toneGuide = {
    casual: 'conversational and engaging, like a smart friend',
    professional: 'clear and informative, like a quality newsletter',
    technical: 'detailed and precise, with technical context',
  };

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `Today is ${today}. Generate a news briefing about: ${topic}

Briefing length: ${lengthGuide[settings.briefingLength]}
Bullet points per story: ${settings.briefingLength === 'short' ? '2-3' : settings.briefingLength === 'medium' ? '3-4' : '4-5'}
Tone: ${toneGuide[settings.tone]}`;
}
