import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';
import Anthropic from '@anthropic-ai/sdk';
import { getSchedules, saveSchedule, shouldSendNow, type ScheduledBrief } from '@/lib/schedules';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

interface Article {
  title: string;
  url: string;
  source: string;
}

interface Briefing {
  topic: string;
  summary: string;
  articles: Article[];
}

async function generateBriefing(topics: string[]): Promise<Briefing[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const briefings: Briefing[] = [];

  for (const topic of topics) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a news briefing assistant. Generate a concise news briefing about "${topic}" with the latest developments. 

Format your response as JSON:
{
  "summary": "A 2-3 paragraph summary of the most important recent news about this topic. Use **bold** for key points.",
  "articles": [
    {"title": "Article title", "source": "Source name", "url": "https://example.com"}
  ]
}

Focus on the most significant recent developments. Keep the summary informative but concise.`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          briefings.push({
            topic,
            summary: parsed.summary,
            articles: parsed.articles || [],
          });
        } catch {
          briefings.push({
            topic,
            summary: content.text,
            articles: [],
          });
        }
      }
    } catch (error) {
      console.error(`Error generating briefing for ${topic}:`, error);
      briefings.push({
        topic,
        summary: `Unable to generate briefing for ${topic} at this time.`,
        articles: [],
      });
    }
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
    const articlesHtml = b.articles.length > 0 ? `
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px;">Sources:</p>
        ${b.articles.map(a => `
          <a href="${a.url}" style="color: #2563eb; text-decoration: none; font-size: 13px; display: block; margin: 4px 0;">
            ${a.source}: ${a.title}
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
        <div style="color: #374151;">
          <p style="margin: 0 0 12px; line-height: 1.6;">
            ${formattedSummary}
          </p>
        </div>
        ${articlesHtml}
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
    <body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="margin: 0; font-size: 28px; color: #1f2937;">
            Your Daily Briefing
          </h1>
          <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
            ${date}
          </p>
        </div>
        
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

async function sendBriefingEmail(schedule: ScheduledBrief, briefings: Briefing[]): Promise<void> {
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
    html: formatBriefingEmail(briefings, schedule.email),
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

    for (const schedule of schedules) {
      if (!shouldSendNow(schedule)) {
        continue;
      }

      try {
        // Generate briefings for this schedule's topics
        const briefings = await generateBriefing(schedule.topics);
        
        // Send email
        await sendBriefingEmail(schedule, briefings);
        
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
