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
  date?: string; // ISO date or relative like "2 hours ago"
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

// OpenAI voices
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
// Google Neural2 en-US voices
export type GoogleVoice = 'en-US-Neural2-A' | 'en-US-Neural2-C' | 'en-US-Neural2-D' | 'en-US-Neural2-E' | 'en-US-Neural2-F' | 'en-US-Neural2-G' | 'en-US-Neural2-H' | 'en-US-Neural2-I' | 'en-US-Neural2-J';
export type VoiceOption = OpenAIVoice | GoogleVoice;

export interface Settings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks: boolean;
  tone: 'casual' | 'professional' | 'technical';
  voice: VoiceOption;
  email?: string;
  autoEmailEnabled?: boolean;
}
