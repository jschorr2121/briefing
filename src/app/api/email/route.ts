import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { sendBriefingEmail, type EmailBriefing } from '@/lib/email';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const briefings = body?.briefings as EmailBriefing[] | undefined;

    if (
      !Array.isArray(briefings) || briefings.length === 0 || briefings.length > 10 ||
      !briefings.every(b => b && typeof b.topic === 'string' && typeof b.summary === 'string')
    ) {
      return NextResponse.json({ error: 'Invalid briefings' }, { status: 400 });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json({ error: 'Email delivery not configured' }, { status: 501 });
    }

    await sendBriefingEmail(user.email, briefings.map(b => ({
      ...b,
      articles: Array.isArray(b.articles) ? b.articles : [],
      stories: Array.isArray(b.stories) ? b.stories : [],
    })));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
