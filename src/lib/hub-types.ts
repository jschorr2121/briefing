// Hub-specific types

export interface HubStory {
  id: string;
  headline: string;
  summary: string; // 2-3 sentence summary
  fullSummary: string; // Full AI-generated summary
  source: string;
  sourceUrl: string;
  topic: string;
  topicEmoji: string;
  timestamp: string; // ISO date
  imageUrl?: string;
  reactions: {
    fire: number;    // 🔥 important
    boring: number;  // 💤 boring
    mindblown: number; // 🤯 surprising
  };
  crossTopics?: string[]; // For cross-topic discovery stories
  relevanceScore?: number; // Computed by the algorithm
}

export interface UserReaction {
  storyId: string;
  reaction: 'fire' | 'boring' | 'mindblown';
  timestamp: number;
}

export interface StoryInteraction {
  storyId: string;
  topic: string;
  source: string;
  action: 'click' | 'skip' | 'expand' | 'collapse';
  timeSpentMs?: number; // Time spent on expanded view
  timestamp: number;
}

export interface TopicAffinity {
  topic: string;
  score: number; // 0-1
  interactions: number;
  lastInteraction: number;
}

export interface SourcePreference {
  source: string;
  score: number; // 0-1
  interactions: number;
}

export interface TasteProfile {
  topicAffinities: Record<string, TopicAffinity>;
  sourcePreferences: Record<string, SourcePreference>;
  totalInteractions: number;
  lastUpdated: number;
  // Engagement patterns
  avgTimeSpentMs: number;
  expandRate: number; // % of stories expanded
  reactionRate: number; // % of stories reacted to
}

export interface FeedRequest {
  tasteProfile?: TasteProfile;
  cursor?: string; // For pagination
  count?: number;
}

export interface FeedResponse {
  stories: HubStory[];
  cursor?: string;
  hasMore: boolean;
}

// Discovery topics that can surface interesting cross-domain stories
export const DISCOVERY_TOPICS = [
  { name: 'AI', emoji: '🤖', queries: ['artificial intelligence news', 'AI breakthroughs'] },
  { name: 'Finance', emoji: '💰', queries: ['stock market news', 'cryptocurrency news', 'economic news'] },
  { name: 'Technology', emoji: '💻', queries: ['tech industry news', 'software development news'] },
  { name: 'Science', emoji: '🔬', queries: ['science discoveries', 'research breakthroughs'] },
  { name: 'World', emoji: '🌍', queries: ['breaking world news', 'geopolitics'] },
  { name: 'Sports', emoji: '⚽', queries: ['sports news highlights', 'NFL NBA scores'] },
  { name: 'Business', emoji: '📈', queries: ['business news', 'startup funding news'] },
  { name: 'Health', emoji: '🏥', queries: ['health news', 'medical breakthroughs'] },
  { name: 'Climate', emoji: '🌱', queries: ['climate change news', 'renewable energy'] },
  { name: 'Space', emoji: '🚀', queries: ['space exploration news', 'NASA SpaceX'] },
  { name: 'Culture', emoji: '🎭', queries: ['entertainment news', 'pop culture trends'] },
  { name: 'Crypto', emoji: '₿', queries: ['bitcoin ethereum news', 'blockchain developments'] },
];
