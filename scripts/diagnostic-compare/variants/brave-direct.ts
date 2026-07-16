import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { polishToCards } from '../polish.js';

const VARIANT = 'brave-direct';
const BRAVE_BASE = 'https://api.search.brave.com/res/v1/news/search';
let lastBraveCallMs = 0;
const BRAVE_MIN_GAP_MS = 1200;

function countUniqueDomains(netlocs: string[]): number {
  return new Set(netlocs.filter(Boolean)).size;
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

  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return {
      variant: VARIANT,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0.005,
        cost_basis: '$5/1k requests = $0.005/request',
        results_count: 0,
        unique_domains: 0,
        error: 'Missing BRAVE_API_KEY env var',
      },
    };
  }

  const wait = BRAVE_MIN_GAP_MS - (Date.now() - lastBraveCallMs);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      q: config.label,
      count: '10',
      freshness: config.braveFreshness ?? 'pw',
      country: 'US',
      extra_snippets: 'true',
    });

    const res = await fetch(`${BRAVE_BASE}?${params}`, {
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
      },
    });
    lastBraveCallMs = Date.now();
    if (!res.ok) throw new Error(`Brave News HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const latency_ms = Date.now() - t0;

    interface BraveNewsResult {
      title?: string;
      url?: string;
      description?: string;
      age?: string;
      page_age?: string;
      meta_url?: { netloc?: string };
      breaking?: boolean;
      extra_snippets?: string[];
    }

    const results: BraveNewsResult[] = data.results ?? [];

    const rawForPolish = results.map((r) => {
      const extraSnippets = r.extra_snippets?.join(' ') ?? '';
      const snippet = [r.description, extraSnippets].filter(Boolean).join(' ');
      return {
        title: r.title ?? '',
        url: r.url ?? '',
        source: r.meta_url?.netloc ?? '',
        date: r.age ?? r.page_age ?? '',
        snippet,
      };
    });

    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const netlocs = results.map((r) => r.meta_url?.netloc ?? '').filter(Boolean);

    return {
      variant: VARIANT,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 0.005,
        cost_basis: '$5/1k requests = $0.005/request',
        results_count: results.length,
        unique_domains: countUniqueDomains(netlocs),
      },
    };
  } catch (e) {
    return {
      variant: VARIANT,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0.005,
        cost_basis: '$5/1k requests = $0.005/request',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
