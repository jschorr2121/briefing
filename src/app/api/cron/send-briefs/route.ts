import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';
import { getSchedules, saveSchedule, shouldSendNow, type ScheduledBrief } from '@/lib/schedules';
import { getGenerationModel, getOpenAIModel } from '@/lib/models';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

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
}

interface Briefing {
  topic: string;
  summary: string;
  stories: StoryCard[];
  articles: Article[];
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

interface HealthTip {
  emoji: string;
  category: string;
  tip: string;
}

async function generateHealthTips(): Promise<HealthTip[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  try {
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    const response = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getOpenAIModel(),
          messages: [{
            role: 'user',
            content: `Generate 2-3 practical health tips for today (${dayOfWeek}). Mix categories like: nutrition, exercise, sleep, mental health, hydration, posture, stretching, or habits.

Keep tips actionable and specific. Format as JSON array:
[
  {"emoji": "🥗", "category": "Nutrition", "tip": "Add leafy greens to one meal today - they're packed with magnesium for energy."},
  {"emoji": "🚶", "category": "Movement", "tip": "Take a 10-minute walk after lunch to boost afternoon focus."}
]

Return only valid JSON, no markdown.`
          }],
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Error generating health tips:', error);
    return [];
  }
}

function formatBriefingEmail(briefings: Briefing[], recipientEmail: string, healthTips?: HealthTip[]): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sections = briefings.map(b => {
    // Format story cards
    const storiesHtml = b.stories.length > 0 ? b.stories.map(story => `
      <div style="margin-bottom: 20px; padding: 16px; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #1f2937;">
          ${story.headline}
        </h3>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          ${story.bullets.map(bullet => `<li style="margin: 4px 0; line-height: 1.5;">${bullet}</li>`).join('')}
        </ul>
        ${story.source && story.url ? `
          <a href="${story.url}" style="display: inline-block; margin-top: 12px; color: #2563eb; text-decoration: none; font-size: 13px;">
            ${story.source} →
          </a>
        ` : ''}
      </div>
    `).join('') : '';

    // Format additional sources
    const sourcesHtml = b.articles.length > 0 ? `
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px;">More sources:</p>
        ${b.articles.slice(0, 3).map(a => `
          <a href="${a.url}" style="color: #2563eb; text-decoration: none; font-size: 13px; display: block; margin: 4px 0;">
            ${a.source}: ${a.title.substring(0, 60)}${a.title.length > 60 ? '...' : ''}
          </a>
        `).join('')}
      </div>
    ` : '';

    const formattedSummary = b.summary
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin: 0 0 12px; line-height: 1.6;">')
      .replace(/\n/g, '<br>');

    return `
      <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #1f2937;">
          ${b.topic}
        </h2>
        <div style="color: #374151; margin-bottom: 16px;">
          <p style="margin: 0 0 12px; line-height: 1.6;">
            ${formattedSummary}
          </p>
        </div>
        ${storiesHtml}
        ${sourcesHtml}
      </div>
    `;
  }).join('');

  // Health tips section
  const healthTipsHtml = healthTips && healthTips.length > 0 ? `
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #a7f3d0;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #065f46; display: flex; align-items: center; gap: 8px;">
        💪 Daily Health Tips
      </h2>
      ${healthTips.map(tip => `
        <div style="background: white; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; border: 1px solid #d1fae5;">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 24px;">${tip.emoji}</span>
            <div>
              <span style="font-size: 11px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">${tip.category}</span>
              <p style="margin: 4px 0 0; color: #374151; font-size: 14px; line-height: 1.5;">${tip.tip}</p>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="margin: 0; font-size: 28px; color: #1f2937;">
            📰 Your Daily Briefing
          </h1>
          <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
            ${date}
          </p>
        </div>
        
        ${healthTipsHtml}
        
        ${sections}
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            You're receiving this because you scheduled a briefing at Briefing.
            <br>
            <a href="${process.env.NEXTAUTH_URL}/schedule" style="color: #2563eb;">Manage your schedules</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendBriefingEmail(schedule: ScheduledBrief, briefings: Briefing[], healthTips: HealthTip[]): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP not configured');
  }

  const transporter = createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  await transporter.sendMail({
    from: `"Briefing" <${smtpUser}>`,
    to: schedule.email,
    subject: `📰 Your Briefing — ${date}`,
    html: formatBriefingEmail(briefings, schedule.email, healthTips),
  });
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedules = await getSchedules();
    const results: { id: string; status: string; error?: string }[] = [];

    // Generate health tips once for all emails
    const healthTips = await generateHealthTips();
    console.log(`Generated ${healthTips.length} health tips for today`);

    for (const schedule of schedules) {
      if (!shouldSendNow(schedule)) {
        continue;
      }

      try {
        // Generate briefings for this schedule's topics
        const briefings = await generateBriefings(schedule.topics);
        
        // Send email with health tips
        await sendBriefingEmail(schedule, briefings, healthTips);
        
        // Update last sent timestamp
        schedule.lastSentAt = new Date().toISOString();
        await saveSchedule(schedule);
        
        results.push({ id: schedule.id, status: 'sent' });
        console.log(`Sent briefing to ${schedule.email}`);
      } catch (error) {
        console.error(`Error sending to ${schedule.email}:`, error);
        results.push({ 
          id: schedule.id, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({ 
      processed: results.length,
      results 
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
