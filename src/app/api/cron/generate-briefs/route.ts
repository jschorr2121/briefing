import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, shouldSendNow } from '@/lib/schedules';
import { generateBriefingsForCron } from '@/lib/briefing-pipeline';
import {
  getCachedScheduleBriefings,
  setCachedScheduleBriefings,
  type ScheduledBriefing,
} from '@/lib/briefing-cache';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const testEmail = request.nextUrl.searchParams.get('testEmail');
    let due = (await getSchedules()).filter(shouldSendNow);
    if (testEmail) due = due.filter(s => s.email === testEmail);

    if (due.length === 0) return NextResponse.json({ generated: 0, cached: [] });

    const today = new Date().toISOString().slice(0, 10);
    const generated: ScheduledBriefing[] = [];
    for (const schedule of due) {
      const briefings = await generateBriefingsForCron(schedule.topics);
      generated.push({
        email: schedule.email,
        topics: schedule.topics,
        briefings,
        generatedAt: new Date().toISOString(),
      });
    }

    // Merge by email so re-runs don't clobber other users' entries.
    const existing = (await getCachedScheduleBriefings(today)) ?? [];
    const emails = new Set(generated.map(g => g.email));
    const merged = [...existing.filter(e => !emails.has(e.email)), ...generated];
    await setCachedScheduleBriefings(today, merged);

    return NextResponse.json({
      generated: generated.length,
      cacheKey: `briefings:cache:${today}`,
      cached: generated.map(c => ({ email: c.email, topics: c.topics.length, briefings: c.briefings.length })),
    });
  } catch (error) {
    console.error('Generate briefs error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
