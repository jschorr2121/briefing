import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { polishToCards } from '../polish.js';

const VARIANT = 'exa-direct';
const EXA_BASE = 'https://api.exa.ai/search';

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function countUniqueDomains(urls: string[]): number {
  return new Set(urls.map(hostnameFromUrl).filter(Boolean)).size;
}

export async function run(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  if (dryRun) {
    return {
      variant: VARIANT,
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

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      variant: VARIANT,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0,
        cost_basis: 'actual cost from Exa response',
        results_count: 0,
        unique_domains: 0,
        error: 'Missing EXA_API_KEY env var',
      },
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch(EXA_BASE, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: config.label,
        type: 'auto',
        category: 'news',
        numResults: 10,
        contents: {
          highlights: { numSentences: 2 },
          text: { maxCharacters: 500 },
        },
        startPublishedDate: sevenDaysAgo(),
      }),
    });
    if (!res.ok) throw new Error(`Exa HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const latency_ms = Date.now() - t0;

    interface ExaResult {
      title?: string;
      url?: string;
      publishedDate?: string;
      author?: string;
      highlights?: string[];
      text?: string;
    }

    interface ExaCostDollars {
      total?: number;
    }

    const results: ExaResult[] = data.results ?? [];
    const costDollars: ExaCostDollars = data.costDollars ?? {};
    const cost_estimate_usd = costDollars.total ?? 0;

    const rawForPolish = results.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      source: hostnameFromUrl(r.url ?? ''),
      date: r.publishedDate ?? '',
      snippet: r.highlights?.join(' ') || r.text || '',
    }));

    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = results.map((r) => r.url ?? '').filter(Boolean);

    return {
      variant: VARIANT,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd,
        cost_basis: 'actual cost from Exa response',
        results_count: results.length,
        unique_domains: countUniqueDomains(urls),
      },
    };
  } catch (e) {
    return {
      variant: VARIANT,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: 'actual cost from Exa response',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
