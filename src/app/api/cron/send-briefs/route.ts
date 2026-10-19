import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, shouldSendNow, markScheduleSent } from '@/lib/schedules';
import { sendBriefingEmail } from '@/lib/email';
import { generateBriefingsForCron } from '@/lib/briefing-pipeline';
import {
  getCachedScheduleBriefings,
  setCachedScheduleBriefings,
  deleteCachedScheduleBriefings,
} from '@/lib/briefing-cache';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error');

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const schedules = await getSchedules();
    // shouldSendNow is false for disabled schedules and ones already sent today (UTC).
    const dueFor = (email: string) => schedules.filter(s => s.email === email && shouldSendNow(s));
    const results: { email: string; status: string; error?: string; source: string }[] = [];

    const cached = await getCachedScheduleBriefings(today);

    if (cached && cached.length > 0) {
      const remaining = [];
      for (const item of cached) {
        const due = dueFor(item.email);
        if (due.length === 0) {
          results.push({ email: item.email, status: 'skipped', source: 'cache' });
          continue; // already sent today (or schedule gone/disabled): drop it
        }
        try {
          await sendBriefingEmail(item.email, item.briefings);
          for (const s of due) await markScheduleSent(s.id);
          results.push({ email: item.email, status: 'sent', source: 'cache' });
        } catch (error) {
          console.error(`Error sending to ${item.email}:`, error);
          results.push({ email: item.email, status: 'error', error: errMsg(error), source: 'cache' });
          remaining.push(item); // keep for retry
        }
      }
      if (remaining.length) await setCachedScheduleBriefings(today, remaining);
      else await deleteCachedScheduleBriefings(today);
    } else {
      // No cache: generate on the fly for due schedules not yet sent today.
      for (const schedule of schedules) {
        if (!shouldSendNow(schedule)) continue;
        try {
          const briefings = await generateBriefingsForCron(schedule.topics);
          if (briefings.length === 0) {
            results.push({ email: schedule.email, status: 'skipped', source: 'generated' });
            continue;
          }
          await sendBriefingEmail(schedule.email, briefings);
          await markScheduleSent(schedule.id);
          results.push({ email: schedule.email, status: 'sent', source: 'generated' });
        } catch (error) {
          console.error(`Error sending to ${schedule.email}:`, error);
          results.push({ email: schedule.email, status: 'error', error: errMsg(error), source: 'generated' });
        }
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error('Send briefs error:', error);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
}
