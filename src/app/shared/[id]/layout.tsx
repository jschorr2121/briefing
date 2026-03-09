import type { Metadata } from 'next';
import { Redis } from '@upstash/redis';

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

interface SharedData {
  topicNames?: string[];
  generatedAt?: string;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: 'Shared Briefing | Briefing',
    description: 'AI-generated news briefing — personalized topics, curated stories.',
    openGraph: {
      title: 'Shared Briefing | Briefing',
      description: 'Check out this AI-generated news briefing — personalized topics, curated stories from top sources.',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Shared Briefing | Briefing',
      description: 'Check out this AI-generated news briefing — personalized topics, curated stories from top sources.',
    },
  };

  try {
    const redis = getRedis();
    if (!redis) return fallback;

    const data = await redis.get<SharedData>(`share:briefing:${id}`);
    if (!data || !data.topicNames?.length) return fallback;

    const topics = data.topicNames.slice(0, 5).join(', ');
    const title = `${topics} — Briefing`;
    const description = `AI-generated news briefing covering ${topics}. Personalized topics, curated stories from top sources.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
