export interface Topic {
  id: string;
  name: string;
  emoji: string;
  enabled: boolean;
}

export interface Article {
  title: string;
  source: string;
  url: string;
  snippet?: string;
}

export interface StoryCard {
  headline: string;
  bullets: string[];
  source?: string;
  url?: string;
}

export interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  stories?: StoryCard[];
  articles: Article[];
  generatedAt: string;
  readingTime?: number;
  searchProvider?: 'openai' | 'brave';
}

export interface BriefingHistory {
  id: string;
  briefings: Briefing[];
  generatedAt: string;
  topicNames: string[];
}

export interface Settings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks: boolean;
  tone: 'casual' | 'professional' | 'technical';
  email?: string;
  autoEmailEnabled?: boolean;
}
