import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';

/**
 * Dev-only endpoint — sets a mock NextAuth session cookie for Playwright tests.
 * Returns 403 in production so this can never be exploited in live environments.
 *
 * Usage: GET /api/test/auth-setup
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'NEXTAUTH_SECRET not configured' }, { status: 500 });
  }

  const maxAge = 30 * 24 * 60 * 60; // 30 days

  const token = await encode({
    token: {
      email: 'test@briefing.dev',
      name: 'Test User',
      picture: null,
      sub: 'test-user-id',
    },
    secret,
    maxAge,
  });

  const response = NextResponse.json({ ok: true, email: 'test@briefing.dev' });

  // NextAuth v4 uses 'next-auth.session-token' (no __Secure- prefix in dev)
  response.cookies.set('next-auth.session-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  return response;
}
