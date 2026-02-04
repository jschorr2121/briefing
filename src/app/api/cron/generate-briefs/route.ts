import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getSchedules, shouldSendNow, type ScheduledBrief } from '@/lib/schedules';
import { getOpenAIModel } from '@/lib/models';

const CRON_SECRET = process.env.CRON_SECRET;

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface Article {
  title: string;
  url: string;
  source: string;
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
  summary: string;
  stories: StoryCard[];
  articles: Article[];
}

interface CachedBriefing {
  email: string;
  topics: string[];
  briefings: Briefing[];
  generatedAt: string;
}

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

async function generateBriefingWithOpenAI(topic: string): Promise<Briefing> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `Search for the latest news about: ${topic}

After searching, create a news briefing with:
1. A brief 2-3 sentence overview summary
2. 3-4 individual story cards

For each story, provide:
- A clear headline (max 15 words)
- 2-3 bullet points explaining the key details
- The source name and URL

Format your response as JSON:
{
  "summary": "Brief overview...",
  "stories": [
    {
      "headline": "Story headline",
      "bullets": ["Key point 1", "Key point 2"],
      "source": "Source Name",
      "url": "https://..."
    }
  ]
}

Only return valid JSON, no markdown code blocks.`;

  try {
    const response = await fetchWithRetry(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getOpenAIModel(),
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

    // Extract the output text
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

    if (!outputText) {
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
      let cleanText = outputText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = cleanText.substring(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
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
      topic,
      summary: parsed.summary || outputText.substring(0, 300),
      stories: parsed.stories || [],
      articles: uniqueArticles.slice(0, 5),
    };
  } catch (error) {
    console.error(`Error generating briefing for ${topic}:`, error);
    return {
      topic,
      summary: `Unable to generate briefing for ${topic} at this time.`,
      stories: [],
      articles: [],
    };
  }
}

async function generateBriefings(topics: string[]): Promise<Briefing[]> {
  // Cap at 4 topics max
  const cappedTopics = topics.slice(0, 4);
  const briefings: Briefing[] = [];

  for (const topic of cappedTopics) {
    const briefing = await generateBriefingWithOpenAI(topic);
    briefings.push(briefing);
    // Small delay between topics to avoid rate limits
    await delay(500);
  }

  return briefings;
}

function getCacheKey(date?: string): string {
  const d = date || new Date().toISOString().split('T')[0];
  return `briefings:cache:${d}`;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for test mode (single email)
    const testEmail = request.nextUrl.searchParams.get('testEmail');
    
    const schedules = await getSchedules();
    console.log(`Found ${schedules.length} total schedules`);
    
    // Filter to schedules that should send today
    let schedulesToGenerate = schedules.filter(schedule => {
      const shouldSend = shouldSendNow(schedule);
      console.log(`Schedule ${schedule.id} (${schedule.email}): shouldGenerate=${shouldSend}`);
      return shouldSend;
    });
    
    // If test mode, filter to only the test email
    if (testEmail) {
      schedulesToGenerate = schedulesToGenerate.filter(s => s.email === testEmail);
      console.log(`Test mode: filtered to ${testEmail} only`);
    }
    
    console.log(`${schedulesToGenerate.length} schedules to generate briefings for`);
    
    if (schedulesToGenerate.length === 0) {
      return NextResponse.json({ generated: 0, cached: [] });
    }

    const cached: CachedBriefing[] = [];

    // Generate briefings for each schedule sequentially
    for (const schedule of schedulesToGenerate) {
      console.log(`Generating briefings for ${schedule.email}...`);
      
      const briefings = await generateBriefings(schedule.topics);
      
      const cachedBriefing: CachedBriefing = {
        email: schedule.email,
        topics: schedule.topics,
        briefings,
        generatedAt: new Date().toISOString(),
      };
      
      cached.push(cachedBriefing);
      console.log(`Generated ${briefings.length} briefings for ${schedule.email}`);
    }

    // Store in Redis with today's date
    const cacheKey = getCacheKey();
    await redis.set(cacheKey, cached, { ex: 86400 }); // Expire after 24 hours as backup
    console.log(`Cached ${cached.length} briefings under ${cacheKey}`);

    return NextResponse.json({ 
      generated: cached.length,
      cacheKey,
      cached: cached.map(c => ({ email: c.email, topics: c.topics.length, briefings: c.briefings.length }))
    });
  } catch (error) {
    console.error('Generate briefs error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
