import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import {
  getSchedulesByUser,
  saveSchedule,
  deleteSchedule,
  type ScheduledBrief
} from '@/lib/schedules';

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

    const body = await request.json();
    const { email, topics, frequency, time, timezone } = body;

    if (!email || !topics?.length || !frequency || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const schedule: ScheduledBrief = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.email,
      email,
      topics,
      frequency,
      time,
      timezone: timezone || 'America/New_York',
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

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    // Verify ownership
    const schedules = await getSchedulesByUser(user.email);
    const existing = schedules.find(s => s.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const updated: ScheduledBrief = {
      ...existing,
      ...updates,
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
