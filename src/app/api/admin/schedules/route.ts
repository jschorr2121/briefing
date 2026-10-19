import { NextRequest, NextResponse } from 'next/server';
import { getSchedules } from '@/lib/schedules';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { UNLIMITED_EMAILS } from '@/lib/subscription';

// GET /api/admin/schedules - List all schedules (for debugging)
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    let ok = !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
    if (!ok) {
      const user = await getAuthenticatedUser(request);
      ok = !!user?.email && UNLIMITED_EMAILS.includes(user.email.toLowerCase());
    }
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const schedules = await getSchedules();
    
    return NextResponse.json({
      count: schedules.length,
      schedules: schedules.map(s => ({
        id: s.id,
        email: s.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email
        topics: s.topics,
        time: s.time,
        enabled: s.enabled,
        lastSentAt: s.lastSentAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}
