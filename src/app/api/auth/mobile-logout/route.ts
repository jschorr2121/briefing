import { NextRequest, NextResponse } from 'next/server';
import { revokeMobileSession } from '@/lib/mobile-auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer brf_')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    const token = authHeader.slice(7);
    await revokeMobileSession(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mobile logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
