import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { checkUsage, getTopicLimit } from '@/lib/subscription';
import { generateBriefing } from '@/lib/briefing-pipeline';

interface Topic {
  id: string;
  name: string;
  emoji: string;
}

interface Settings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks: boolean;
  tone: 'casual' | 'professional' | 'technical';
}

// ─── POST handler ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Check auth
    const user = await getAuthenticatedUser(request);
    const email = user?.email;

    // Check usage limits if user is authenticated
    if (email) {
      const usage = await checkUsage(email);
      if (!usage.allowed) {
        return NextResponse.json(
          {
            error: 'Daily briefing limit reached',
            code: 'LIMIT_REACHED',
            usage: { used: usage.used, limit: usage.limit, tier: usage.tier },
          },
          { status: 429 }
        );
      }
    }

    const { topics, settings } = await request.json() as { topics: Topic[]; settings: Settings };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'No topics provided' }, { status: 400 });
    }

    // Cap topics based on user's limit (null = unlimited for admin/dev)
    const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    const topicLimit = devMode ? null : getTopicLimit(email);
    const cappedTopics = topicLimit ? topics.slice(0, topicLimit) : topics;

    const result = await generateBriefing(cappedTopics, { ...settings, skipCache: devMode });
    return NextResponse.json({ briefings: result.briefings, model: result.model });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}
