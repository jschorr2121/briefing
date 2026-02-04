import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';
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

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const prompt = `Today is ${today}. Search for the latest news about: ${topic}

After searching, create a news briefing with:
1. A brief 2-3 sentence overview summary
2. 3-4 individual story cards

For each story, provide:
- A clear headline (max 15 words)
- 2-3 bullet points explaining the key details
- The publication date (e.g. "Feb 4, 2026")
- The source name and URL

IMPORTANT: Every story MUST include a "date" field with the publication date. Only include stories from the last 7 days.

Format your response as JSON:
{
  "summary": "Brief overview...",
  "stories": [
    {
      "headline": "Story headline",
      "bullets": ["Key point 1", "Key point 2"],
      "source": "Source Name",
      "url": "https://...",
      "date": "Feb 4, 2026"
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

    let parsed: { summary: string; stories: StoryCard[] };
    try {
      let cleanText = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        parsed = JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1));
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      parsed = { summary: outputText.substring(0, 500).replace(/[{}"]/g, ''), stories: [] };
    }

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
    return { topic, summary: `Unable to generate briefing for ${topic}.`, stories: [], articles: [] };
  }
}

async function generateBriefings(topics: string[]): Promise<Briefing[]> {
  const cappedTopics = topics.slice(0, 4);
  const briefings: Briefing[] = [];
  for (const topic of cappedTopics) {
    briefings.push(await generateBriefingWithOpenAI(topic));
    await delay(500);
  }
  return briefings;
}

function formatBriefingEmail(briefings: Briefing[], recipientEmail: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sections = briefings.map(b => {
    const storiesHtml = b.stories && b.stories.length > 0 ? b.stories.map((story, i) => `
      <div style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 600; color: #60a5fa; background: rgba(96,165,250,0.15); padding: 2px 8px; border-radius: 4px;">#${i + 1}</span>
          ${story.date ? `<span style="font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${story.date}</span>` : ''}
        </div>
        <h3 style="margin: 0 0 10px; font-size: 15px; color: #93c5fd; font-weight: 600;">
          ${story.headline}
        </h3>
        <ul style="margin: 0; padding-left: 16px; color: #d1d5db;">
          ${story.bullets.map(bullet => `<li style="margin: 6px 0; line-height: 1.5; font-size: 13px;">${bullet}</li>`).join('')}
        </ul>
        ${story.source && story.url ? `
          <a href="${story.url}" style="display: inline-block; margin-top: 12px; color: #60a5fa; text-decoration: none; font-size: 12px;">
            ${story.source} →
          </a>
        ` : ''}
      </div>
    `).join('') : '';

    const sourcesHtml = b.articles.length > 0 && (!b.stories || b.stories.length === 0) ? `
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="font-size: 11px; color: #60a5fa; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Sources</p>
        ${b.articles.slice(0, 3).map(a => `
          <a href="${a.url}" style="color: #93c5fd; text-decoration: none; font-size: 12px; display: block; margin: 4px 0;">
            ${a.source}: ${a.title.substring(0, 50)}${a.title.length > 50 ? '...' : ''}
          </a>
        `).join('')}
      </div>
    ` : '';

    const formattedSummary = b.summary
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #93c5fd;">$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin: 0 0 10px; line-height: 1.6;">')
      .replace(/\n/g, '<br>');

    return `
      <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08);">
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #60a5fa; font-weight: 600;">
          ${b.topic}
        </h2>
        <p style="font-size: 11px; color: #60a5fa; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Highlights</p>
        <div style="color: #d1d5db; font-size: 14px;">
          <p style="margin: 0 0 10px; line-height: 1.6;">
            ${formattedSummary}
          </p>
        </div>
        ${storiesHtml}
        ${sourcesHtml}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #fff;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 24px; color: #fff; font-weight: 600;">
            Your News Briefing
          </h1>
          <p style="margin: 8px 0 0; color: #666; font-size: 13px;">
            ${date}
          </p>
        </div>
        
        ${sections}
        
        <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
          <p style="color: #444; font-size: 11px; margin: 0;">
            You're receiving this because you scheduled a briefing.
            <br>
            <a href="${process.env.NEXTAUTH_URL || 'https://briefing-five.vercel.app'}/schedule" style="color: #60a5fa;">Manage your schedules</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendBriefingEmail(email: string, briefings: Briefing[]): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP not configured');
  }

  const transporter = createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass },
  });

  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  await transporter.sendMail({
    from: `"Briefing" <${smtpUser}>`,
    to: email,
    subject: `📰 Your Briefing — ${date}`,
    html: formatBriefingEmail(briefings, email),
  });
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

    // Check for cached briefings first
    const cacheKey = getCacheKey();
    const cached = await redis.get<CachedBriefing[]>(cacheKey);
    
    const results: { email: string; status: string; error?: string; source: string }[] = [];
    
    if (cached && cached.length > 0) {
      // Use cached briefings - send all at once!
      console.log(`Found ${cached.length} cached briefings, sending...`);
      
      for (const item of cached) {
        try {
          await sendBriefingEmail(item.email, item.briefings);
          results.push({ email: item.email, status: 'sent', source: 'cache' });
          console.log(`Sent cached briefing to ${item.email}`);
        } catch (error) {
          console.error(`Error sending to ${item.email}:`, error);
          results.push({ 
            email: item.email, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error',
            source: 'cache'
          });
        }
      }
      
      // Clean up cache after sending
      await redis.del(cacheKey);
      console.log(`Deleted cache key ${cacheKey}`);
      
    } else {
      // No cache - generate on the fly (fallback for manual triggers or missed generation)
      console.log('No cached briefings found, generating on the fly...');
      
      const schedules = await getSchedules();
      for (const schedule of schedules) {
        if (!shouldSendNow(schedule)) continue;

        try {
          const briefings = await generateBriefings(schedule.topics);
          await sendBriefingEmail(schedule.email, briefings);
          results.push({ email: schedule.email, status: 'sent', source: 'generated' });
          console.log(`Sent generated briefing to ${schedule.email}`);
        } catch (error) {
          console.error(`Error sending to ${schedule.email}:`, error);
          results.push({ 
            email: schedule.email, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error',
            source: 'generated'
          });
        }
      }
    }

    return NextResponse.json({ 
      processed: results.length,
      results 
    });
  } catch (error) {
    console.error('Send briefs error:', error);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
}
