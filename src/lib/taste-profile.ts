import type { TasteProfile, TopicAffinity, SourcePreference, StoryInteraction, UserReaction, HubStory } from './hub-types';

const TASTE_PROFILE_KEY = 'hub-taste-profile';
const INTERACTIONS_KEY = 'hub-interactions';
const REACTIONS_KEY = 'hub-reactions';

// Decay factor - older interactions matter less
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDecayFactor(timestampMs: number): number {
  const age = Date.now() - timestampMs;
  return Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
}

// Initialize empty taste profile
function createEmptyProfile(): TasteProfile {
  return {
    topicAffinities: {},
    sourcePreferences: {},
    totalInteractions: 0,
    lastUpdated: Date.now(),
    avgTimeSpentMs: 0,
    expandRate: 0,
    reactionRate: 0,
  };
}

// Load taste profile from localStorage
export function loadTasteProfile(): TasteProfile {
  if (typeof window === 'undefined') return createEmptyProfile();
  try {
    const stored = localStorage.getItem(TASTE_PROFILE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load taste profile:', e);
  }
  return createEmptyProfile();
}

// Save taste profile to localStorage
export function saveTasteProfile(profile: TasteProfile): void {
  if (typeof window === 'undefined') return;
  try {
    profile.lastUpdated = Date.now();
    localStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save taste profile:', e);
  }
}

// Record a story interaction
export function recordInteraction(interaction: StoryInteraction): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(INTERACTIONS_KEY);
    const interactions: StoryInteraction[] = stored ? JSON.parse(stored) : [];
    interactions.push(interaction);
    // Keep last 500 interactions
    const trimmed = interactions.slice(-500);
    localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(trimmed));
    
    // Update taste profile
    updateProfileFromInteraction(interaction);
  } catch (e) {
    console.error('Failed to record interaction:', e);
  }
}

// Record a reaction
export function recordReaction(reaction: UserReaction): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(REACTIONS_KEY);
    const reactions: UserReaction[] = stored ? JSON.parse(stored) : [];
    // Remove any existing reaction for the same story
    const filtered = reactions.filter(r => r.storyId !== reaction.storyId);
    filtered.push(reaction);
    const trimmed = filtered.slice(-500);
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to record reaction:', e);
  }
}

// Get user's reaction for a story
export function getReaction(storyId: string): UserReaction | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(REACTIONS_KEY);
    if (!stored) return null;
    const reactions: UserReaction[] = JSON.parse(stored);
    return reactions.find(r => r.storyId === storyId) || null;
  } catch {
    return null;
  }
}

// Update profile from a single interaction
function updateProfileFromInteraction(interaction: StoryInteraction): void {
  const profile = loadTasteProfile();
  
  // Update topic affinity
  const topic = interaction.topic;
  if (!profile.topicAffinities[topic]) {
    profile.topicAffinities[topic] = {
      topic,
      score: 0.5, // Start neutral
      interactions: 0,
      lastInteraction: Date.now(),
    };
  }
  
  const topicAffinity = profile.topicAffinities[topic];
  topicAffinity.interactions++;
  topicAffinity.lastInteraction = Date.now();
  
  // Adjust score based on action
  const scoreAdjustment = getScoreAdjustment(interaction);
  // Use exponential moving average with learning rate
  const learningRate = Math.max(0.05, 0.3 / Math.sqrt(topicAffinity.interactions));
  topicAffinity.score = Math.max(0, Math.min(1, 
    topicAffinity.score + learningRate * scoreAdjustment
  ));
  
  // Update source preference
  const source = interaction.source;
  if (source) {
    if (!profile.sourcePreferences[source]) {
      profile.sourcePreferences[source] = {
        source,
        score: 0.5,
        interactions: 0,
      };
    }
    const sourcePref = profile.sourcePreferences[source];
    sourcePref.interactions++;
    const srcLearningRate = Math.max(0.05, 0.3 / Math.sqrt(sourcePref.interactions));
    sourcePref.score = Math.max(0, Math.min(1,
      sourcePref.score + srcLearningRate * scoreAdjustment
    ));
  }
  
  // Update engagement patterns
  profile.totalInteractions++;
  if (interaction.timeSpentMs) {
    const alpha = 0.1;
    profile.avgTimeSpentMs = profile.avgTimeSpentMs * (1 - alpha) + interaction.timeSpentMs * alpha;
  }
  
  saveTasteProfile(profile);
}

// Get score adjustment for an interaction type
function getScoreAdjustment(interaction: StoryInteraction): number {
  switch (interaction.action) {
    case 'click':
    case 'expand':
      // Positive signal - user was interested
      const timeBonus = interaction.timeSpentMs 
        ? Math.min(0.2, interaction.timeSpentMs / 30000) // Up to 0.2 bonus for 30s+ reading
        : 0;
      return 0.15 + timeBonus;
    case 'skip':
      // Slight negative signal
      return -0.05;
    case 'collapse':
      // Quick collapse = mild negative
      if (interaction.timeSpentMs && interaction.timeSpentMs < 2000) {
        return -0.08;
      }
      return 0;
    default:
      return 0;
  }
}

// Apply reaction to profile
export function applyReactionToProfile(storyTopic: string, storySource: string, reaction: 'fire' | 'boring' | 'mindblown'): void {
  const profile = loadTasteProfile();
  
  const adjustments: Record<string, number> = {
    fire: 0.25,      // Strong positive
    boring: -0.2,    // Negative
    mindblown: 0.3,  // Very strong positive
  };
  
  const adjustment = adjustments[reaction] || 0;
  
  // Apply to topic
  if (profile.topicAffinities[storyTopic]) {
    profile.topicAffinities[storyTopic].score = Math.max(0, Math.min(1,
      profile.topicAffinities[storyTopic].score + adjustment
    ));
  }
  
  // Apply to source
  if (storySource && profile.sourcePreferences[storySource]) {
    const srcAdj = adjustment * 0.5; // Half the effect for sources
    profile.sourcePreferences[storySource].score = Math.max(0, Math.min(1,
      profile.sourcePreferences[storySource].score + srcAdj
    ));
  }
  
  saveTasteProfile(profile);
}

// Get top topics for content generation
export function getTopTopics(profile: TasteProfile, count: number = 5): string[] {
  const entries = Object.entries(profile.topicAffinities);
  if (entries.length === 0) return [];
  
  return entries
    .sort((a, b) => {
      // Sort by score * decay factor
      const scoreA = a[1].score * getDecayFactor(a[1].lastInteraction);
      const scoreB = b[1].score * getDecayFactor(b[1].lastInteraction);
      return scoreB - scoreA;
    })
    .slice(0, count)
    .map(([topic]) => topic);
}

// Rank stories based on taste profile
export function rankStories(stories: HubStory[], profile: TasteProfile): HubStory[] {
  if (profile.totalInteractions < 3) {
    // Not enough data - return in original order with slight randomization
    return shuffleWithBias(stories);
  }
  
  const scored = stories.map(story => {
    let score = 0;
    
    // Topic affinity (highest weight)
    const topicAffinity = profile.topicAffinities[story.topic];
    if (topicAffinity) {
      score += topicAffinity.score * 40 * getDecayFactor(topicAffinity.lastInteraction);
    } else {
      // Unknown topic gets a discovery bonus
      score += 15;
    }
    
    // Source preference
    const sourcePref = profile.sourcePreferences[story.source];
    if (sourcePref) {
      score += sourcePref.score * 15;
    }
    
    // Cross-topic discovery bonus
    if (story.crossTopics && story.crossTopics.length > 1) {
      const crossScore = story.crossTopics.reduce((sum, t) => {
        const aff = profile.topicAffinities[t];
        return sum + (aff ? aff.score * 8 : 3);
      }, 0);
      score += crossScore;
    }
    
    // Recency boost (newer stories get a slight boost)
    const ageMs = Date.now() - new Date(story.timestamp).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const recencyBoost = Math.max(0, 10 - ageHours * 0.5);
    score += recencyBoost;
    
    // Small random factor for diversity
    score += Math.random() * 5;
    
    return { ...story, relevanceScore: score };
  });
  
  return scored.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

// Shuffle with slight randomization but keep general order
function shuffleWithBias(stories: HubStory[]): HubStory[] {
  return stories
    .map(s => ({ ...s, sort: Math.random() * 0.3 + 0.7 }))
    .sort((a, b) => (b as any).sort - (a as any).sort)
    .map(({ sort, ...s }) => s as HubStory);
}

// Get topic distribution for feed request
export function getTopicDistribution(profile: TasteProfile): {
  primary: string[];
  secondary: string[];
  discovery: string[];
} {
  const entries = Object.entries(profile.topicAffinities)
    .map(([topic, aff]) => ({
      topic,
      score: aff.score * getDecayFactor(aff.lastInteraction),
    }))
    .sort((a, b) => b.score - a.score);
  
  if (entries.length === 0) {
    return {
      primary: ['AI', 'Technology', 'World'],
      secondary: ['Science', 'Business'],
      discovery: ['Culture', 'Space'],
    };
  }
  
  const highThreshold = 0.6;
  const midThreshold = 0.3;
  
  const primary = entries.filter(e => e.score >= highThreshold).map(e => e.topic);
  const secondary = entries.filter(e => e.score >= midThreshold && e.score < highThreshold).map(e => e.topic);
  
  // Discovery = topics not in primary or secondary
  const knownTopics = new Set([...primary, ...secondary]);
  const allTopics = ['AI', 'Technology', 'Finance', 'World', 'Science', 'Business', 'Sports', 'Health', 'Climate', 'Space', 'Culture', 'Crypto'];
  const discovery = allTopics.filter(t => !knownTopics.has(t));
  
  return {
    primary: primary.length > 0 ? primary.slice(0, 4) : ['AI', 'Technology', 'World'],
    secondary: secondary.slice(0, 3),
    discovery: discovery.sort(() => Math.random() - 0.5).slice(0, 2),
  };
}
