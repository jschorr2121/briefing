import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { runAgentLoop } from '../agent-driver.js';
import { BRAVE_TOOLS, buildBriefingSystemPrompt } from '../briefing-prompt.js';

const VARIANT = 'brave-agent';
const BRAVE_BASE = 'https://api.search.brave.com/res/v1/news/search';
let lastBraveCallMs = 0;
const BRAVE_MIN_GAP_MS = 1200;

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

function dryRunResult(topic: string): VariantResult {
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

async function toolRunner(toolName: string, input: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('Missing BRAVE_API_KEY env var');

  if (toolName === 'brave_news_search') {
    const params = new URLSearchParams();
    if (input.q) params.set('q', String(input.q));
    if (input.freshness) params.set('freshness', String(input.freshness));
    if (input.count != null) params.set('count', String(input.count));
    if (input.country) params.set('country', String(input.country));
    if (input.extra_snippets != null) params.set('extra_snippets', String(input.extra_snippets));

    const braveWait = BRAVE_MIN_GAP_MS - (Date.now() - lastBraveCallMs);
    if (braveWait > 0) await new Promise((r) => setTimeout(r, braveWait));

    const res = await fetch(`${BRAVE_BASE}?${params}`, {
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
      },
    });
    lastBraveCallMs = Date.now();
    if (!res.ok) throw new Error(`Brave News HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

export async function run(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  if (dryRun) return dryRunResult(topic);

  const t0 = Date.now();
  try {
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: BRAVE_TOOLS,
      toolRunner,
    });

    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = 0.005 * toolCalls;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;

    return {
      variant: VARIANT,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: 'Claude Sonnet 4.6 tokens + Brave Search API calls',
        results_count: cards.length,
        unique_domains: countUniqueDomains(urls),
        tool_calls: toolCalls,
        tokens: agentResult.tokens,
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
        cost_basis: 'Claude Sonnet 4.6 tokens + Brave Search API calls',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
