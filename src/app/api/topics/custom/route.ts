import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { createCustomTopicConfig } from '@/lib/topic-engine';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const query = body?.query;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty "query" field' }, { status: 400 });
  }

  try {
    const topic = await createCustomTopicConfig(query.trim());
    return NextResponse.json({ topic });
  } catch (error) {
    console.error('Custom topic creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create custom topic' },
      { status: 500 },
    );
  }
}
