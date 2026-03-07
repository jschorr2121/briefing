import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// Shared briefing TTL: 30 days
const SHARE_TTL_SECONDS = 30 * 24 * 60 * 60;

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function shareKey(id: string): string {
  return `share:briefing:${id}`;
}

// POST: Save a briefing and return a share URL
export async function POST(request: NextRequest) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { briefings, topicNames, generatedAt } = body;

    if (!briefings || !Array.isArray(briefings) || briefings.length === 0) {
      return NextResponse.json({ error: 'No briefings provided' }, { status: 400 });
    }

    const id = nanoid(10);
    const sharedData = {
      id,
      briefings,
      topicNames: topicNames || briefings.map((b: { topic: string }) => b.topic),
      generatedAt: generatedAt || new Date().toISOString(),
      sharedAt: new Date().toISOString(),
    };

    await redis.set(shareKey(id), sharedData, { ex: SHARE_TTL_SECONDS });

    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    return NextResponse.json({
      id,
      url: `${baseUrl}/shared/${id}`,
      expiresIn: '30 days',
    });
  } catch (error) {
    console.error('Share error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

// GET: Retrieve a shared briefing
export async function GET(request: NextRequest) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing share ID' }, { status: 400 });
    }

    const data = await redis.get(shareKey(id));
    if (!data) {
      return NextResponse.json({ error: 'Briefing not found or expired' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Share fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch shared briefing' }, { status: 500 });
  }
}
