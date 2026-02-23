import { NextResponse } from 'next/server';
import { getCuratedTopicsByCategory } from '@/lib/topic-engine';

export async function GET() {
  const byCategory = getCuratedTopicsByCategory();

  // Strip internal fields (keywordQuery, vectorPrompt, sourceGroup, queryStrategy) —
  // only expose what the frontend needs for display + selection.
  const categories: Record<string, { id: string; displayName: string; type: string }[]> = {};

  for (const [category, configs] of Object.entries(byCategory)) {
    categories[category] = configs.map(c => ({
      id: c.id,
      displayName: c.displayName,
      type: c.type,
    }));
  }

  return NextResponse.json({ categories });
}
