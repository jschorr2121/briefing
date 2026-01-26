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
}

export interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  articles: Article[];
  generatedAt: string;
}

export interface Settings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks: boolean;
  tone: 'casual' | 'professional' | 'technical';
}
