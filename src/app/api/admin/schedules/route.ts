import { NextRequest, NextResponse } from 'next/server';
import { getSchedules } from '@/lib/schedules';

// GET /api/admin/schedules - List all schedules (for debugging)
export async function GET(request: NextRequest) {
  try {
    const schedules = await getSchedules();
    
    return NextResponse.json({
      count: schedules.length,
      schedules: schedules.map(s => ({
        id: s.id,
        email: s.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email
        topics: s.topics,
        time: s.time,
        enabled: s.enabled,
        lastSent: s.lastSent,
      })),
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}
