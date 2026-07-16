import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { getQueryPlan } from '../perigon-flows/news-rebuild/query-planner.js';
import { fetchForPlan } from '../perigon-flows/news-rebuild/fetch-orchestrator.js';
import type { NewsCard } from '../perigon-flows/news-rebuild/rank.js';
import type { StoryCard } from '../types.js';

function cardToStoryCard(card: NewsCard): StoryCard {
  return {
    headline: card.title,
    bullets: [card.summary].filter(Boolean),
    source: card.source,
    date: card.pubDate ? card.pubDate.split('T')[0] : '',
    url: card.url,
  };
}

function uniqueDomains(cards: NewsCard[]): number {
  const domains = new Set(
    cards.map((c) => {
      try { return new URL(c.url).hostname.replace(/^www\./, ''); } catch { return ''; }
    }).filter(Boolean)
  );
  return domains.size;
}

export async function run(topic: string, _config: TopicConfig, dryRun: boolean): Promise<VariantResult> {
  if (dryRun) {
    return {
      variant: 'perigon-flow-news-rebuild',
      topic,
      briefing: {
        cards: [{
          headline: `[DRY RUN] News-rebuild flow for ${topic}`,
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
    const plan = await getQueryPlan(topic);
    const { cards, perigonCalls } = await fetchForPlan(plan);
    const latency_ms = Date.now() - start;

    const storyCards = cards.map(cardToStoryCard);
    const apiCost = perigonCalls * 0.008;

    return {
      variant: 'perigon-flow-news-rebuild',
      topic,
      briefing: { cards: storyCards.slice(0, 6) },
      metrics: {
        latency_ms,
        cost_estimate_usd: apiCost,
        cost_basis: `estimate: $0.008/request on Basic plan × ${perigonCalls} Perigon calls`,
        results_count: storyCards.length,
        unique_domains: uniqueDomains(cards),
        api_calls: perigonCalls,
      },
    };
  } catch (e) {
    return {
      variant: 'perigon-flow-news-rebuild',
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
