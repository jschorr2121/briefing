import { NextRequest, NextResponse } from 'next/server';

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
  searchProvider: 'openai' | 'brave';
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

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry and exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited, wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
        console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
        await delay(Math.min(waitTime, 10000));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(Math.pow(2, i) * 1000);
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// OpenAI Web Search using Responses API
async function fetchFromOpenAISearch(
  topic: string,
  queries: string[],
  settings: Settings
): Promise<{ summary: string; stories: StoryCard[]; articles: Article[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('No OpenAI API key found');
    throw new Error('OpenAI API key not configured');
  }

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
  const prompt = `Search for the latest news about: ${topic}

Search queries to consider: ${searchQuery}

After searching, create a news briefing with:
1. A brief 2-3 sentence overview summary of the topic area
2. Individual story cards for ${lengthGuide[settings.briefingLength]}

For each story, provide:
- A clear headline (max 15 words)
- ${settings.briefingLength === 'short' ? '2-3' : settings.briefingLength === 'medium' ? '3-4' : '4-5'} bullet points that fully explain the story (who, what, when, why, significance)
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

  try {
    // Using OpenAI Responses API with web_search tool
    const response = await fetchWithRetry(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          tools: [
            { 
              type: 'web_search',
              user_location: {
                type: 'approximate',
                country: 'US'
              }
            }
          ],
          tool_choice: 'auto',
          input: prompt,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Responses API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response structure:', JSON.stringify(data, null, 2).substring(0, 500));

    // Extract the output text
    let outputText = data.output_text || '';
    
    // Also check for message content in output array
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

    if (!outputText) {
      console.error('No output text in OpenAI response');
      throw new Error('No output from OpenAI');
    }

    // Extract citations from annotations
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

    // Parse the JSON response
    let parsed: { summary: string; stories: StoryCard[] };
    try {
      // Clean up the output text - remove markdown code blocks if present
      let cleanText = outputText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      console.log('Cleaned output text (first 500 chars):', cleanText.substring(0, 500));
      
      // Try to extract JSON from the response - handle nested braces properly
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = cleanText.substring(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(jsonStr);
        console.log('Successfully parsed JSON, stories count:', parsed.stories?.length || 0);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw output text:', outputText.substring(0, 1000));
      // Fallback: create a simple structure from the text
      parsed = {
        summary: outputText.substring(0, 500).replace(/[{}"]/g, ''),
        stories: []
      };
    }

    // Deduplicate articles
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
  } catch (error) {
    console.error('OpenAI web search error:', error);
    throw error;
  }
}

// Fallback: Brave Search
async function fetchFromBraveSearch(query: string): Promise<Article[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    console.log('No Brave API key found');
    return [];
  }

  try {
    const response = await fetchWithRetry(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8&freshness=pd`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('Brave search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.web?.results || []).slice(0, 8).map((result: {
      title: string;
      url: string;
      description?: string;
    }) => ({
      title: result.title,
      source: new URL(result.url).hostname.replace('www.', ''),
      url: result.url,
      snippet: result.description,
    }));
  } catch (error) {
    console.error('Brave search error:', error);
    return [];
  }
}

// Fallback summary generation with Anthropic
async function generateFallbackSummary(
  articles: Article[],
  topic: string,
  settings: Settings
): Promise<{ summary: string; stories: StoryCard[] }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicKey || articles.length === 0) {
    // Super fallback: just format articles
    if (articles.length === 0) {
      return {
        summary: `No recent news found for ${topic}. Check back later for updates.`,
        stories: []
      };
    }

    const stories: StoryCard[] = articles.slice(0, 4).map(a => ({
      headline: a.title.replace(/\s*\|.*$/, '').trim(),
      bullets: a.snippet ? [a.snippet] : ['Click through to read more'],
      source: a.source,
      url: a.url,
    }));

    return {
      summary: `Here are the latest stories about ${topic}.`,
      stories
    };
  }

  const lengthGuide = {
    short: '3 stories with 2-3 bullets each',
    medium: '4-5 stories with 3-4 bullets each',
    long: '5-6 stories with 4-5 bullets each'
  };

  const toneGuide = {
    casual: 'conversational and friendly',
    professional: 'clear and informative',
    technical: 'detailed and precise'
  };

  const articleContext = articles.slice(0, 8).map((a, i) => 
    `${i + 1}. "${a.title}" (${a.source})${a.snippet ? `\n   ${a.snippet}` : ''}\n   URL: ${a.url}`
  ).join('\n\n');

  const prompt = `Create a news briefing about ${topic} from these articles:

${articleContext}

Return JSON with:
1. A brief 2-3 sentence overview summary
2. Individual story cards: ${lengthGuide[settings.briefingLength]}

Each story needs:
- headline (max 15 words)
- bullets array (complete explanation of the story)
- source name
- url

Tone: ${toneGuide[settings.tone]}

Format:
{
  "summary": "...",
  "stories": [
    {"headline": "...", "bullets": ["...", "..."], "source": "...", "url": "..."}
  ]
}

Return only valid JSON.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
    });

    if (!response.ok) {
      throw new Error('Anthropic API error');
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('No JSON in response');
  } catch (error) {
    console.error('Anthropic fallback error:', error);
    // Ultimate fallback
    const stories: StoryCard[] = articles.slice(0, 4).map(a => ({
      headline: a.title.replace(/\s*\|.*$/, '').trim(),
      bullets: a.snippet ? [a.snippet] : ['Click through to read more'],
      source: a.source,
      url: a.url,
    }));

    return {
      summary: `Here are the latest stories about ${topic}.`,
      stories
    };
  }
}

async function generateBriefingForTopic(
  topic: Topic,
  settings: Settings
): Promise<Briefing> {
  const queries = TOPIC_QUERIES[topic.id] || [`${topic.name} news today`];
  
  let summary: string;
  let stories: StoryCard[] = [];
  let articles: Article[] = [];
  let searchProvider: 'openai' | 'brave' = 'openai';

  // Try OpenAI web search first
  try {
    console.log(`Trying OpenAI web search for ${topic.name}...`);
    const result = await fetchFromOpenAISearch(topic.name, queries, settings);
    summary = result.summary;
    stories = result.stories;
    articles = result.articles;
    searchProvider = 'openai';
    console.log(`OpenAI search succeeded for ${topic.name}, got ${stories.length} stories`);
  } catch (error) {
    console.log(`OpenAI search failed for ${topic.name}, falling back to Brave:`, error);
    
    // Fallback to Brave Search + Anthropic
    searchProvider = 'brave';
    for (const query of queries) {
      const results = await fetchFromBraveSearch(query);
      articles.push(...results);
      if (articles.length >= 8) break;
    }

    // Deduplicate
    const seen = new Set<string>();
    articles = articles.filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    const fallbackResult = await generateFallbackSummary(articles, topic.name, settings);
    summary = fallbackResult.summary;
    stories = fallbackResult.stories;
  }

  return {
    topic: topic.name,
    emoji: topic.emoji,
    summary,
    stories,
    articles: settings.includeLinks ? articles.slice(0, 5) : [],
    generatedAt: new Date().toISOString(),
    searchProvider,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { topics, settings } = await request.json() as {
      topics: Topic[];
      settings: Settings;
    };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'No topics provided' }, { status: 400 });
    }

    // Generate briefings sequentially to avoid rate limits
    const briefings: Briefing[] = [];
    for (const topic of topics) {
      const briefing = await generateBriefingForTopic(topic, settings);
      briefings.push(briefing);
      // Small delay between topics
      await delay(500);
    }

    return NextResponse.json({ briefings });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
