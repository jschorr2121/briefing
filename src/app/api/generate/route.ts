import { NextRequest, NextResponse } from 'next/server';

interface Topic {
  id: string;
  name: string;
  emoji: string;
}

interface Settings {
  briefingLength: 'short' | 'medium' | 'long';
  includeLinks: boolean;
  tone: 'casual' | 'professional' | 'technical';
}

interface Article {
  title: string;
  source: string;
  url: string;
  snippet?: string;
}

interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  articles: Article[];
  generatedAt: string;
}

// Search queries for each topic
const TOPIC_QUERIES: Record<string, string[]> = {
  ai: ['AI artificial intelligence news', 'machine learning breakthrough', 'OpenAI Google DeepMind'],
  finance: ['stock market news today', 'crypto bitcoin news', 'federal reserve interest rates'],
  world: ['world news today', 'international politics', 'global events'],
  sports: ['NBA NFL sports news', 'Premier League soccer', 'sports highlights'],
  science: ['science discovery news', 'space NASA news', 'medical research breakthrough'],
  startups: ['startup funding news', 'tech startup unicorn', 'venture capital investment'],
};

// RSS feeds as backup
const TOPIC_FEEDS: Record<string, string[]> = {
  ai: [
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  ],
  finance: [
    'https://feeds.bloomberg.com/markets/news.rss',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  ],
  sports: [
    'https://www.espn.com/espn/rss/news',
    'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
  ],
  science: [
    'https://www.sciencedaily.com/rss/all.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
  ],
  startups: [
    'https://techcrunch.com/category/startups/feed/',
    'https://news.ycombinator.com/rss',
  ],
};

async function fetchFromBraveSearch(query: string): Promise<Article[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pd`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return (data.web?.results || []).slice(0, 5).map((result: {
      title: string;
      url: string;
      description?: string;
    }) => ({
      title: result.title,
      source: new URL(result.url).hostname.replace('www.', ''),
      url: result.url,
      snippet: result.description,
    }));
  } catch (error) {
    console.error('Brave search error:', error);
    return [];
  }
}

async function fetchFromRSS(feedUrl: string): Promise<Article[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Briefing/1.0' },
    });
    if (!response.ok) return [];

    const text = await response.text();
    const articles: Article[] = [];

    // Simple XML parsing for RSS
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/i;
    const linkRegex = /<link>(.*?)<\/link>/i;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/i;

    let match;
    while ((match = itemRegex.exec(text)) !== null && articles.length < 5) {
      const item = match[1];
      const titleMatch = titleRegex.exec(item);
      const linkMatch = linkRegex.exec(item);
      const descMatch = descRegex.exec(item);

      if (titleMatch && linkMatch) {
        const title = (titleMatch[1] || titleMatch[2] || '').trim();
        const url = linkMatch[1].trim();
        const snippet = descMatch ? (descMatch[1] || descMatch[2] || '').replace(/<[^>]*>/g, '').trim() : undefined;

        articles.push({
          title,
          source: new URL(url).hostname.replace('www.', ''),
          url,
          snippet: snippet?.substring(0, 200),
        });
      }
    }

    return articles;
  } catch (error) {
    console.error('RSS fetch error:', error);
    return [];
  }
}

function generateSummary(articles: Article[], topic: string, settings: Settings): string {
  if (articles.length === 0) {
    return `No recent news found for ${topic}. Check back later for updates.`;
  }

  const lengthLimit = settings.briefingLength === 'short' ? 3 : settings.briefingLength === 'medium' ? 5 : 8;
  const selectedArticles = articles.slice(0, lengthLimit);

  // Generate summary from article titles and snippets
  const summaryParts = selectedArticles.map((article, i) => {
    const snippet = article.snippet 
      ? ` - ${article.snippet.substring(0, 150)}${article.snippet.length > 150 ? '...' : ''}`
      : '';
    return `**${article.title}**${snippet}`;
  });

  return summaryParts.join('\n\n');
}

async function generateBriefingForTopic(
  topic: Topic,
  settings: Settings
): Promise<Briefing> {
  const queries = TOPIC_QUERIES[topic.id] || [topic.name + ' news'];
  const feeds = TOPIC_FEEDS[topic.id] || [];

  // Try search first, fall back to RSS
  let articles: Article[] = [];

  // Try Brave search
  for (const query of queries) {
    const results = await fetchFromBraveSearch(query);
    articles.push(...results);
    if (articles.length >= 5) break;
  }

  // If no search results, try RSS feeds
  if (articles.length < 3) {
    for (const feed of feeds) {
      const results = await fetchFromRSS(feed);
      articles.push(...results);
      if (articles.length >= 5) break;
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  articles = articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  const summary = generateSummary(articles, topic.name, settings);

  return {
    topic: topic.name,
    emoji: topic.emoji,
    summary,
    articles: settings.includeLinks ? articles.slice(0, 5) : [],
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { topics, settings } = await request.json() as {
      topics: Topic[];
      settings: Settings;
    };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'No topics provided' }, { status: 400 });
    }

    // Generate briefings for all topics in parallel
    const briefings = await Promise.all(
      topics.map(topic => generateBriefingForTopic(topic, settings))
    );

    return NextResponse.json({ briefings });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
