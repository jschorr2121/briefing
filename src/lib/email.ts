import { createTransport } from 'nodemailer';

export interface EmailBriefing {
  topic: string;
  emoji?: string;
  summary: string;
  stories?: { headline: string; bullets: string[]; source?: string; url?: string; date?: string }[];
  articles: { title: string; url: string; source: string }[];
}

export const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeUrl = (u: unknown): string | null =>
  typeof u === 'string' && /^https?:\/\//i.test(u) ? escapeHtml(u) : null;

export function formatBriefingEmail(briefings: EmailBriefing[]): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const base = (process.env.NEXTAUTH_URL || 'https://briefing-five.vercel.app').replace(/\/+$/, '');

  const sections = briefings.map(b => {
    const storiesHtml = b.stories?.length ? b.stories.map((story, i) => {
      const href = safeUrl(story.url);
      return `
      <div style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 600; color: #60a5fa; background: rgba(96,165,250,0.15); padding: 2px 8px; border-radius: 4px;">#${i + 1}</span>
          ${story.date ? `<span style="font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${escapeHtml(story.date)}</span>` : ''}
        </div>
        <h3 style="margin: 0 0 10px; font-size: 15px; color: #93c5fd; font-weight: 600;">
          ${escapeHtml(story.headline)}
        </h3>
        <ul style="margin: 0; padding-left: 16px; color: #d1d5db;">
          ${(story.bullets || []).map(bullet => `<li style="margin: 6px 0; line-height: 1.5; font-size: 13px;">${escapeHtml(bullet)}</li>`).join('')}
        </ul>
        ${story.source && href ? `
          <a href="${href}" style="display: inline-block; margin-top: 12px; color: #60a5fa; text-decoration: none; font-size: 12px;">
            ${escapeHtml(story.source)} →
          </a>
        ` : ''}
      </div>
    `;
    }).join('') : '';

    const sourcesHtml = b.articles?.length && !b.stories?.length ? `
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="font-size: 11px; color: #60a5fa; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Sources</p>
        ${b.articles.slice(0, 3).map(a => {
          const href = safeUrl(a.url);
          const label = `${escapeHtml(a.source)}: ${escapeHtml(a.title.substring(0, 50))}${a.title.length > 50 ? '...' : ''}`;
          return href
            ? `<a href="${href}" style="color: #93c5fd; text-decoration: none; font-size: 12px; display: block; margin: 4px 0;">${label}</a>`
            : `<span style="color: #93c5fd; font-size: 12px; display: block; margin: 4px 0;">${label}</span>`;
        }).join('')}
      </div>
    ` : '';

    // Escape first, then apply markdown-ish formatting on the escaped text.
    const formattedSummary = escapeHtml(b.summary)
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #93c5fd;">$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin: 0 0 10px; line-height: 1.6;">')
      .replace(/\n/g, '<br>');

    return `
      <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08);">
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #60a5fa; font-weight: 600;">
          ${escapeHtml(b.topic)}
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
            ${escapeHtml(date)}
          </p>
        </div>

        ${sections}

        <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
          <p style="color: #444; font-size: 11px; margin: 0;">
            You're receiving this because you scheduled a briefing.
            <br>
            <a href="${escapeHtml(base)}/schedule" style="color: #60a5fa;">Manage your schedules</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendBriefingEmail(
  to: string,
  briefings: EmailBriefing[],
  opts?: { subjectPrefix?: string }
): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) throw new Error('SMTP not configured');

  const transporter = createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  await transporter.sendMail({
    from: `"Briefing" <${smtpUser}>`,
    to,
    subject: `${opts?.subjectPrefix ?? ''}Your Briefing — ${date}`,
    html: formatBriefingEmail(briefings),
  });
}
