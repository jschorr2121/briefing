import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import {
  getSchedulesByUser,
  saveSchedule,
  deleteSchedule,
  type ScheduledBrief
} from '@/lib/schedules';

const FREQS = ['daily', 'weekdays', 'weekly'];
const MAX_SCHEDULES = 3;

// Validates the given fields; returns cleaned values or an error string.
function validate(b: any, partial: boolean): { error: string } | { v: Partial<ScheduledBrief> } {
  const v: Partial<ScheduledBrief> = {};
  const has = (k: string) => b[k] !== undefined;
  if (!partial || has('topics')) {
    if (!Array.isArray(b.topics) || b.topics.length < 1 || b.topics.length > 4) return { error: 'topics must be 1-4 items' };
    const t = b.topics.map((x: unknown) => (typeof x === 'string' ? x.trim() : ''));
    if (t.some((x: string) => !x || x.length > 80)) return { error: 'invalid topic' };
    v.topics = t;
  }
  if (!partial || has('frequency')) {
    if (!FREQS.includes(b.frequency)) return { error: 'invalid frequency' };
    v.frequency = b.frequency;
  }
  if (!partial || has('time')) {
    if (typeof b.time !== 'string' || !/^\d{2}:\d{2}$/.test(b.time)) return { error: 'invalid time' };
    v.time = b.time;
  }
  if (has('timezone') || !partial) {
    const tz = b.timezone ?? 'America/New_York';
    if (typeof tz !== 'string' || !tz || tz.length > 64) return { error: 'invalid timezone' };
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return { error: 'invalid timezone' }; }
    v.timezone = tz;
  }
  if (partial && has('enabled')) {
    if (typeof b.enabled !== 'boolean') return { error: 'invalid enabled' };
    v.enabled = b.enabled;
  }
  return { v };
}

// GET - List user's schedules
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedules = await getSchedulesByUser(user.email);
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

// POST - Create new schedule
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const r = validate(body ?? {}, false);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });

    if ((await getSchedulesByUser(user.email)).length >= MAX_SCHEDULES) {
      return NextResponse.json({ error: `Maximum ${MAX_SCHEDULES} schedules` }, { status: 400 });
    }

    const schedule: ScheduledBrief = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      userId: user.email,
      email: user.email,
      topics: r.v.topics!,
      frequency: r.v.frequency!,
      time: r.v.time!,
      timezone: r.v.timezone!,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveSchedule(schedule);
    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}

// PUT - Update schedule
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const id = body?.id;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    // Verify ownership
    const schedules = await getSchedulesByUser(user.email);
    const existing = schedules.find(s => s.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const r = validate(body, true);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });

    const updated: ScheduledBrief = {
      ...existing,
      ...r.v,
      updatedAt: new Date().toISOString(),
    };

    await saveSchedule(updated);
    return NextResponse.json({ schedule: updated });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// DELETE - Remove schedule
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    // Verify ownership
    const schedules = await getSchedulesByUser(user.email);
    const existing = schedules.find(s => s.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    await deleteSchedule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
