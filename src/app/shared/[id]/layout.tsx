import type { Metadata } from 'next';

export const metadata: Metadata = {
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

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
