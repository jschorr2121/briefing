import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIModel } from '@/lib/models';
import type { HubStory, FeedRequest } from '@/lib/hub-types';
import { DISCOVERY_TOPICS } from '@/lib/hub-types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function generateId(): string {
  return `hub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getTopicEmoji(topic: string): string {
  const found = DISCOVERY_TOPICS.find(t => t.name.toLowerCase() === topic.toLowerCase());
  return found?.emoji || '📰';
}

function getTopicQueries(topic: string): string[] {
  const found = DISCOVERY_TOPICS.find(t => t.name.toLowerCase() === topic.toLowerCase());
  return found?.queries || [`${topic} news today`];
}

function buildFeedPrompt(topics: string[], count: number): string {
  const topicList = topics.join(', ');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  return `You are a news curator. Search the web for the latest news stories from TODAY (${today}) and the past 48 hours.

Cover these topics: ${topicList}

For EACH story, provide:
1. A compelling headline (max 12 words)
2. A brief summary (2-3 sentences, engaging and informative)
3. A detailed full summary (4-6 sentences, providing fuller context and analysis)
4. The source name (e.g., "Reuters", "TechCrunch")
5. The direct article URL
6. The primary topic category (one of: ${topicList})
7. The publication timestamp (ISO format)
8. Any cross-topic tags if the story bridges multiple topics

Return EXACTLY ${count} stories as JSON:
{
  "stories": [
    {
      "headline": "Compelling headline here",
      "summary": "Brief 2-3 sentence summary...",
      "fullSummary": "Detailed 4-6 sentence summary with context and analysis...",
      "source": "Source Name",
      "sourceUrl": "https://example.com/article",
      "topic": "Topic Category",
      "timestamp": "2025-01-27T14:30:00Z",
      "crossTopics": ["Topic1", "Topic2"]
    }
  ]
}

IMPORTANT:
- Only include REAL, CURRENT news from the past 48 hours
- Use reputable sources (Reuters, AP, Bloomberg, TechCrunch, etc.)
- Include the ACTUAL article URL, not a homepage
- Make summaries engaging and informative
- Each story should have a unique angle
- Include some stories that bridge multiple topics for discovery
- Do NOT use Wikipedia as a source
- Return valid JSON only, no markdown code blocks`;
}

async function fetchStoriesFromOpenAI(
  topics: string[],
  count: number
): Promise<HubStory[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();
  const prompt = buildFeedPrompt(topics, count);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
      tool_choice: 'auto',
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  let outputText = data.output_text || '';
  
  if (!outputText && data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text' || content.type === 'text') {
            outputText = content.text;
            break;
          }
        }
      }
    }
  }

  if (!outputText) throw new Error('No output from OpenAI');

  // Parse JSON response
  let cleanText = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleanText.indexOf('{');
  const jsonEnd = cleanText.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    throw new Error('Invalid JSON response from OpenAI');
  }

  const parsed = JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1));
  const rawStories = parsed.stories || [];

  // Transform to HubStory format
  const stories: HubStory[] = rawStories.map((s: any) => ({
    id: generateId(),
    headline: s.headline || 'Untitled Story',
    summary: s.summary || '',
    fullSummary: s.fullSummary || s.summary || '',
    source: s.source || 'Unknown',
    sourceUrl: s.sourceUrl || s.url || '#',
    topic: s.topic || topics[0] || 'General',
    topicEmoji: getTopicEmoji(s.topic || topics[0] || 'General'),
    timestamp: s.timestamp || new Date().toISOString(),
    reactions: { fire: 0, boring: 0, mindblown: 0 },
    crossTopics: s.crossTopics || [],
  }));

  return stories;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedRequest = await request.json();
    const { tasteProfile, count = 12 } = body;

    // Determine topic distribution
    let primaryTopics: string[];
    let secondaryTopics: string[];
    let discoveryTopics: string[];

    if (tasteProfile && Object.keys(tasteProfile.topicAffinities).length > 0) {
      // Use taste profile to determine distribution
      const entries = Object.entries(tasteProfile.topicAffinities)
        .map(([topic, aff]) => ({ topic, score: aff.score }))
        .sort((a, b) => b.score - a.score);

      primaryTopics = entries.filter(e => e.score >= 0.6).map(e => e.topic).slice(0, 4);
      secondaryTopics = entries.filter(e => e.score >= 0.3 && e.score < 0.6).map(e => e.topic).slice(0, 3);
      
      const knownTopics = new Set([...primaryTopics, ...secondaryTopics]);
      const allDiscovery = DISCOVERY_TOPICS.map(t => t.name).filter(t => !knownTopics.has(t));
      discoveryTopics = allDiscovery.sort(() => Math.random() - 0.5).slice(0, 2);

      // Fallbacks
      if (primaryTopics.length === 0) primaryTopics = ['AI', 'Technology', 'World'];
      if (secondaryTopics.length === 0) secondaryTopics = ['Science', 'Business'];
      if (discoveryTopics.length === 0) discoveryTopics = ['Culture', 'Space'];
    } else {
      // Default topics for new users
      primaryTopics = ['AI', 'Technology', 'World'];
      secondaryTopics = ['Science', 'Finance'];
      discoveryTopics = ['Business', 'Space'];
    }

    // Calculate story distribution: 60% primary, 30% secondary, 10% discovery
    const primaryCount = Math.ceil(count * 0.6);
    const secondaryCount = Math.ceil(count * 0.3);
    const discoveryCount = Math.max(1, count - primaryCount - secondaryCount);

    // Build the combined topic list with weights
    const allTopics = [
      ...primaryTopics,
      ...secondaryTopics,
      ...discoveryTopics,
    ];

    console.log(`Hub feed: primary=${primaryTopics.join(',')}, secondary=${secondaryTopics.join(',')}, discovery=${discoveryTopics.join(',')}`);

    // Generate stories - single batch call for efficiency
    const stories = await fetchStoriesFromOpenAI(allTopics, count);

    return NextResponse.json({
      stories,
      hasMore: true,
      cursor: Date.now().toString(),
    });
  } catch (error) {
    console.error('Hub feed error:', error);
    return NextResponse.json(
      { error: 'Failed to generate feed', stories: [], hasMore: false },
      { status: 500 }
    );
  }
}
