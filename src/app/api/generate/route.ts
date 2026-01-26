import { NextRequest, NextResponse } from 'next/server';
import { getGenerationModel, getOpenAIModel } from '@/lib/models';

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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
        await delay(Math.min(waitTime, 10000));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) await delay(Math.pow(2, i) * 1000);
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

function buildPrompt(topic: string, queries: string[], settings: Settings): string {
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
  
  return `Search for the latest news about: ${topic}

Search queries to consider: ${searchQuery}

After searching, create a news briefing with:
1. A brief 2-3 sentence overview summary of the topic area
2. Individual story cards for ${lengthGuide[settings.briefingLength]}

For each story, provide:
- A clear headline (max 15 words)
- ${settings.briefingLength === 'short' ? '2-3' : settings.briefingLength === 'medium' ? '3-4' : '4-5'} bullet points that fully explain the story
- The source name and URL

Tone: ${toneGuide[settings.tone]}

Format your response as JSON:
{
  "summary": "Brief overview of the topic area...",
  "stories": [
    {
      "headline": "Story headline",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"],
      "source": "Source Name",
      "url": "https://..."
    }
  ]
}

Only return valid JSON, no markdown code blocks.`;
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
  
  const prompt = buildPrompt(topic, queries, settings);

  const response = await fetchWithRetry('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
      tool_choice: 'auto',
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
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

  const prompt = buildPrompt(topic, queries, settings);

  const response = await fetchWithRetry('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
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
  if (data.citations) {
    for (const citation of data.citations) {
      articles.push({
        title: citation.title || 'News Article',
        source: new URL(citation.url).hostname.replace('www.', ''),
        url: citation.url,
      });
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
    const { topics, settings } = await request.json() as { topics: Topic[]; settings: Settings };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'No topics provided' }, { status: 400 });
    }

    // Cap at 4 topics max
    const cappedTopics = topics.slice(0, 4);
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
