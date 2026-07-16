import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { runAgentLoop } from '../agent-driver.js';
import { NEWSDATA_TOOLS, buildBriefingSystemPrompt } from '../briefing-prompt.js';

const VARIANT = 'newsdata-agent';
const NEWSDATA_BASE = 'https://newsdata.io/api/1/latest';

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
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) throw new Error('Missing NEWSDATA_API_KEY env var');

  if (toolName === 'newsdata_latest') {
    const params = new URLSearchParams({ apikey: apiKey });
    if (input.q) params.set('q', String(input.q));
    if (input.qInTitle) params.set('qInTitle', String(input.qInTitle));
    if (input.timeframe) params.set('timeframe', String(input.timeframe));
    if (input.prioritydomain) params.set('prioritydomain', String(input.prioritydomain));
    if (input.size != null) params.set('size', String(input.size));
    // Array fields as repeated params
    if (Array.isArray(input.language)) {
      for (const v of input.language) params.append('language', v);
    }
    if (Array.isArray(input.category)) {
      for (const v of input.category) params.append('category', v);
    }

    const res = await fetch(`${NEWSDATA_BASE}?${params}`);
    if (!res.ok) throw new Error(`NewsData HTTP ${res.status}: ${await res.text()}`);
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
      tools: NEWSDATA_TOOLS,
      toolRunner,
    });

    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = 0.010 * toolCalls;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;

    return {
      variant: VARIANT,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: 'Claude Sonnet 4.6 tokens + NewsData API calls',
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
        cost_basis: 'Claude Sonnet 4.6 tokens + NewsData API calls',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
