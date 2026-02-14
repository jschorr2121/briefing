import { NextRequest, NextResponse } from 'next/server';
import { createMobileSession } from '@/lib/mobile-auth';

const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'idToken required' }, { status: 400 });
    }

    // Verify Google ID token
    const verifyRes = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${idToken}`);
    if (!verifyRes.ok) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
    }

    const payload = await verifyRes.json();

    // Verify the token was issued for our app
    const clientId = process.env.GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (payload.aud !== clientId) {
      return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 });
    }

    if (!payload.email || !payload.email_verified) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 401 });
    }

    // Create mobile session
    const token = await createMobileSession(
      payload.email,
      payload.name,
      payload.picture
    );

    return NextResponse.json({
      token,
      user: {
        email: payload.email,
        name: payload.name || null,
        image: payload.picture || null,
      },
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
