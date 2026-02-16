import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getGenerationModel, getOpenAIModel } from '@/lib/models';
import { checkAndIncrementUsage, FREE_TOPIC_LIMIT } from '@/lib/subscription';

interface Topic {
  id: string;
  name: string;
  emoji: string;
}

interface Settings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks: boolean;
  tone: 'casual' | 'professional' | 'technical';
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

// Search queries for each topic
const TOPIC_QUERIES: Record<string, string[]> = {
  ai: ['AI artificial intelligence news today', 'OpenAI Anthropic Google AI'],
  finance: ['stock market news today', 'crypto bitcoin ethereum news', 'federal reserve economy'],
  world: ['breaking world news today', 'international politics news'],
  sports: ['NBA NFL sports news today', 'Premier League soccer highlights'],
  science: ['science discovery news this week', 'space NASA research'],
  startups: ['startup funding news', 'tech unicorn venture capital'],
  jets: ['NY Jets NFL news', 'New York Jets football'],
  basketball: ['NBA basketball news today', 'basketball highlights scores'],
};

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
        console.warn(`⚠️ Rate limited (429) on attempt ${i + 1}/${maxRetries}. Waiting ${clampedWait}ms...`);
        if (i < maxRetries - 1) {
          await delay(clampedWait);
          continue;
        }
        // Last attempt — read the body for diagnostics and throw
        const errorBody = await response.text().catch(() => 'unable to read body');
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

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `You are a news briefing generator. Today's date is ${today}. You search the web for recent news and produce structured JSON briefings.

RULES:
- ONLY include news published within the last 7 days. Today is ${today}. Any story older than 7 days MUST be excluded.
- If a story's date is more than 7 days before today, DO NOT include it. This is critical.
- Do NOT use or cite Wikipedia. Only use news sources, official publications, and reputable journalism outlets.
- Prefer primary sources (news outlets, official announcements) over aggregators or encyclopedias.
- Every story MUST include a publication date. Verify the date is within the last 7 days.
- Every story MUST include the SPECIFIC article URL (not the homepage).
- Prioritize stories from the last 48 hours over older ones.

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

function buildUserMessage(topic: string, queries: string[], settings: Settings): string {
  const lengthGuide = {
    short: '3 stories with 2-3 bullets each',
    medium: '4-5 stories with 3-4 bullets each',
    long: '5-6 stories with 4-5 bullets each'
  };
  const toneGuide = {
    casual: 'conversational and engaging, like a smart friend',
    professional: 'clear and informative, like a quality newsletter',
    technical: 'detailed and precise, with technical context'
  };
  const searchQuery = queries.join(' OR ');

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  return `Today is ${today}. Search for the latest news about: ${topic}

Search queries to consider: ${searchQuery}

IMPORTANT: Only include stories published within the last 7 days (after ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}). Exclude anything older.

Briefing length: ${lengthGuide[settings.briefingLength]}
Bullet points per story: ${settings.briefingLength === 'short' ? '2-3' : settings.briefingLength === 'medium' ? '3-4' : '4-5'}
Tone: ${toneGuide[settings.tone]}`;
}

function parseJSONResponse(text: string): { summary: string; stories: StoryCard[] } {
  let cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleanText.indexOf('{');
  const jsonEnd = cleanText.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1));
  }
  return { summary: text.substring(0, 500), stories: [] };
}

// OpenAI Web Search (gpt-4o or gpt-4o-mini)
async function fetchFromOpenAI(
  topic: string,
  queries: string[],
  settings: Settings
): Promise<{ summary: string; stories: StoryCard[]; articles: Article[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();
  console.log(`Using OpenAI model: ${model}`);
  
  const userMessage = buildUserMessage(topic, queries, settings);

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
  
  // Log token usage to verify prompt caching
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

  // Extract citations
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
  const seen = new Set<string>();
  const uniqueArticles = articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  return {
    summary: parsed.summary || outputText.substring(0, 300),
    stories: parsed.stories || [],
    articles: uniqueArticles.slice(0, 8),
  };
}

// Perplexity Search
async function fetchFromPerplexity(
  topic: string,
  queries: string[],
  settings: Settings
): Promise<{ summary: string; stories: StoryCard[]; articles: Article[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const userMessage = buildUserMessage(topic, queries, settings);

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

  // Extract citations if available
  const articles: Article[] = [];
  if (data.citations && Array.isArray(data.citations)) {
    for (const citation of data.citations) {
      try {
        // Citations can be strings (URLs) or objects with url property
        const url = typeof citation === 'string' ? citation : citation?.url;
        if (url && url.startsWith('http')) {
          articles.push({
            title: typeof citation === 'object' ? (citation.title || 'News Article') : 'News Article',
            source: new URL(url).hostname.replace('www.', ''),
            url: url,
          });
        }
      } catch (e) {
        // Skip invalid URLs
        console.log('Skipping invalid citation:', citation);
      }
    }
  }

  const parsed = parseJSONResponse(outputText);

  return {
    summary: parsed.summary || outputText.substring(0, 300),
    stories: parsed.stories || [],
    articles: articles.slice(0, 8),
  };
}

async function generateBriefingForTopic(topic: Topic, settings: Settings): Promise<Briefing> {
  const queries = TOPIC_QUERIES[topic.id] || [`${topic.name} news today`];
  const model = getGenerationModel();
  
  let summary: string;
  let stories: StoryCard[] = [];
  let articles: Article[] = [];

  console.log(`Generating briefing for ${topic.name} using ${model}...`);

  try {
    let result;
    if (model === 'perplexity') {
      result = await fetchFromPerplexity(topic.name, queries, settings);
    } else {
      result = await fetchFromOpenAI(topic.name, queries, settings);
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
    emoji: topic.emoji,
    summary,
    stories,
    articles: settings.includeLinks ? articles.slice(0, 5) : [],
    generatedAt: new Date().toISOString(),
    model,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check auth
    const user = await getAuthenticatedUser(request);
    const email = user?.email;

    // Check usage limits if user is authenticated
    if (email) {
      const usage = await checkAndIncrementUsage(email);
      if (!usage.allowed) {
        return NextResponse.json(
          {
            error: 'Daily briefing limit reached',
            code: 'LIMIT_REACHED',
            usage: { used: usage.used, limit: usage.limit, tier: usage.tier },
          },
          { status: 429 }
        );
      }
    }

    const { topics, settings } = await request.json() as { topics: Topic[]; settings: Settings };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'No topics provided' }, { status: 400 });
    }

    // Free users: cap topics
    let maxTopics = 4;
    if (email) {
      const { getUsageStatus } = await import('@/lib/subscription');
      const status = await getUsageStatus(email);
      if (status.tier === 'free') {
        maxTopics = FREE_TOPIC_LIMIT;
      }
    }

    const cappedTopics = topics.slice(0, maxTopics);
    const briefings: Briefing[] = [];
    
    for (const topic of cappedTopics) {
      const briefing = await generateBriefingForTopic(topic, settings);
      briefings.push(briefing);
      await delay(500);
    }

    return NextResponse.json({ briefings, model: getGenerationModel() });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}
