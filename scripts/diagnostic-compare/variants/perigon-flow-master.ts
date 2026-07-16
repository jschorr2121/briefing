import type { VariantResult, StoryCard } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { fetchArticlesForTopics, type PreparedArticle } from '../perigon-flows/master/briefing-generator.js';

function articleToStoryCard(article: PreparedArticle): StoryCard {
  return {
    headline: article.title,
    bullets: [article.summary].filter(Boolean),
    source: article.source,
    date: article.date,
    url: article.url,
  };
}

function uniqueDomains(articles: PreparedArticle[]): number {
  const domains = new Set(
    articles.map((a) => {
      try { return new URL(a.url).hostname.replace(/^www\./, ''); } catch { return ''; }
    }).filter(Boolean)
  );
  return domains.size;
}

export async function run(topic: string, _config: TopicConfig, dryRun: boolean): Promise<VariantResult> {
  if (dryRun) {
    return {
      variant: 'perigon-flow-master',
      topic,
      briefing: {
        cards: [{
          headline: `[DRY RUN] Master flow for ${topic}`,
          bullets: ['Dry run — no API calls made'],
          source: 'stub',
          date: new Date().toISOString().split('T')[0],
          url: '',
        }],
      },
      metrics: { latency_ms: 0, cost_estimate_usd: 0, cost_basis: 'dry run', results_count: 1, unique_domains: 0 },
    };
  }

  const start = Date.now();
  try {
    const { topics, totalPerigonCalls } = await fetchArticlesForTopics([topic]);
    const latency_ms = Date.now() - start;
    const topicResult = topics[0];
    const articles = topicResult?.articles || [];
    const storyCards = articles.map(articleToStoryCard);
    const apiCost = totalPerigonCalls * 0.008;

    return {
      variant: 'perigon-flow-master',
      topic,
      briefing: { cards: storyCards.slice(0, 6) },
      metrics: {
        latency_ms,
        cost_estimate_usd: apiCost,
        cost_basis: `estimate: $0.008/request on Basic plan × ${totalPerigonCalls} Perigon calls`,
        results_count: storyCards.length,
        unique_domains: uniqueDomains(articles),
        api_calls: totalPerigonCalls,
      },
    };
  } catch (e) {
    return {
      variant: 'perigon-flow-master',
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - start,
        cost_estimate_usd: 0,
        cost_basis: 'error',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
