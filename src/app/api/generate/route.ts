import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { checkAndIncrementUsage, getTopicLimit } from '@/lib/subscription';
import { generateBriefing, type TopicInput, type GenerateSettings } from '@/lib/briefing-pipeline';

const MAX_TOPIC_NAME_CHARS = 80;

export async function POST(request: NextRequest) {
  try {
    // Every generation costs search + LLM money: no session, no briefing.
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usage = await checkAndIncrementUsage(user.email);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily briefing limit reached', code: 'LIMIT_REACHED', usage: { used: usage.used, limit: usage.limit, tier: usage.tier } },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null) as { topics?: TopicInput[]; settings?: GenerateSettings } | null;
    const topics = (body?.topics ?? [])
      .filter(t => t && typeof t.name === 'string' && t.name.trim().length > 0)
      .map(t => ({ id: t.id, name: t.name.trim().slice(0, MAX_TOPIC_NAME_CHARS), emoji: typeof t.emoji === 'string' ? t.emoji : '' }));
    if (topics.length === 0) {
      return NextResponse.json({ error: 'No topics provided' }, { status: 400 });
    }

    const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    const topicLimit = devMode ? null : getTopicLimit(user.email);
    const cappedTopics = topicLimit ? topics.slice(0, topicLimit) : topics;

    const settings: GenerateSettings = {
      briefingLength: body?.settings?.briefingLength ?? 'medium',
      tone: body?.settings?.tone ?? 'professional',
      includeLinks: body?.settings?.includeLinks !== false,
      skipCache: devMode,
    };

    const result = await generateBriefing(cappedTopics, settings);
    return NextResponse.json({ briefings: result.briefings, model: result.model });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}
