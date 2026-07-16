import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { polishToCards } from '../polish.js';

const PERIGON_BASE = 'https://api.perigon.io/v1';

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function countUniqueDomains(urls: string[]): number {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    }),
  );
  return domains.size;
}

function dryRunResult(variant: string, topic: string): VariantResult {
  return {
    variant,
    topic,
    briefing: {
      cards: [{ headline: '[DRY RUN]', bullets: [], source: 'stub', date: '2026-01-01', url: '' }],
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: 'dry run',
      results_count: 1,
      unique_domains: 0,
    },
  };
}

function errorResult(variant: string, topic: string, error: unknown): VariantResult {
  return {
    variant,
    topic,
    briefing: { cards: [] },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0.008,
      cost_basis: 'estimate: $0.008/request on Basic plan',
      results_count: 0,
      unique_domains: 0,
      error: error instanceof Error ? error.message : String(error),
    },
  };
}

export async function runArticles(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  const variant = 'perigon-raw-articles';
  if (dryRun) return dryRunResult(variant, topic);

  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) return errorResult(variant, topic, 'Missing PERIGON_API_KEY env var');

  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      q: config.label,
      size: '10',
      sourceGroup: 'top100',
      excludeLabel: 'Opinion,Press Release',
      from: sevenDaysAgo(),
      sortBy: 'relevance',
      apiKey,
    });

    const res = await fetch(`${PERIGON_BASE}/articles/all?${params}`);
    if (!res.ok) throw new Error(`Perigon articles HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const latency_ms = Date.now() - t0;

    const articles: Array<{ title?: string; url?: string; source?: { domain?: string }; pubDate?: string; description?: string }> =
      data.articles ?? [];

    const rawForPolish = articles.map((a) => ({
      title: a.title ?? '',
      url: a.url ?? '',
      source: a.source?.domain ?? '',
      date: a.pubDate ?? '',
      snippet: a.description ?? '',
    }));

    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = articles.map((a) => a.url ?? '').filter(Boolean);

    return {
      variant,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 0.008,
        cost_basis: 'estimate: $0.008/request on Basic plan',
        results_count: articles.length,
        unique_domains: countUniqueDomains(urls),
      },
    };
  } catch (e) {
    return { ...errorResult(variant, topic, e), metrics: { ...errorResult(variant, topic, e).metrics, latency_ms: Date.now() - t0 } };
  }
}

export async function runStories(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  const variant = 'perigon-raw-stories';
  if (dryRun) return dryRunResult(variant, topic);

  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) return errorResult(variant, topic, 'Missing PERIGON_API_KEY env var');

  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      q: config.label,
      size: '5',
      minUniqueSources: '3',
      sortBy: 'updatedAt',
      apiKey,
    });

    const res = await fetch(`${PERIGON_BASE}/stories/all?${params}`);
    if (!res.ok) throw new Error(`Perigon stories HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const latency_ms = Date.now() - t0;

    const stories: Array<{ name?: string; summary?: string; updatedAt?: string; articles?: Array<{ url?: string; source?: { domain?: string } }> }> =
      data.results ?? data.stories ?? [];

    const rawForPolish = stories.map((s) => {
      const firstArticle = s.articles?.[0];
      return {
        title: s.name ?? '',
        url: firstArticle?.url ?? '',
        source: firstArticle?.source?.domain ?? '',
        date: s.updatedAt ?? '',
        snippet: s.summary ?? '',
      };
    });

    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = stories.flatMap((s) => s.articles?.map((a) => a.url ?? '') ?? []).filter(Boolean);

    return {
      variant,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 0.008,
        cost_basis: 'estimate: $0.008/request on Basic plan',
        results_count: stories.length,
        unique_domains: countUniqueDomains(urls),
      },
    };
  } catch (e) {
    return { ...errorResult(variant, topic, e), metrics: { ...errorResult(variant, topic, e).metrics, latency_ms: Date.now() - t0 } };
  }
}

export async function runVector(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  const variant = 'perigon-raw-vector';
  if (dryRun) return dryRunResult(variant, topic);

  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) return errorResult(variant, topic, 'Missing PERIGON_API_KEY env var');

  const t0 = Date.now();
  try {
    const res = await fetch(`${PERIGON_BASE}/vector/news/all?apiKey=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: config.label, size: 10 }),
    });
    if (!res.ok) throw new Error(`Perigon vector HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const latency_ms = Date.now() - t0;

    const articles: Array<{ title?: string; url?: string; source?: { domain?: string }; pubDate?: string; description?: string }> =
      data.articles ?? data.results ?? [];

    const rawForPolish = articles.map((a) => ({
      title: a.title ?? '',
      url: a.url ?? '',
      source: a.source?.domain ?? '',
      date: a.pubDate ?? '',
      snippet: a.description ?? '',
    }));

    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = articles.map((a) => a.url ?? '').filter(Boolean);

    return {
      variant,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 0.008,
        cost_basis: 'estimate: $0.008/request on Basic plan',
        results_count: articles.length,
        unique_domains: countUniqueDomains(urls),
      },
    };
  } catch (e) {
    return { ...errorResult(variant, topic, e), metrics: { ...errorResult(variant, topic, e).metrics, latency_ms: Date.now() - t0 } };
  }
}
