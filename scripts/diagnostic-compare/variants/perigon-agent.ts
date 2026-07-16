import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { runAgentLoop } from '../agent-driver.js';
import { PERIGON_TOOLS, buildBriefingSystemPrompt } from '../briefing-prompt.js';

const VARIANT = 'perigon-agent';
const PERIGON_BASE = 'https://api.perigon.io/v1';

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
  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) throw new Error('Missing PERIGON_API_KEY env var');

  if (toolName === 'perigon_articles_all') {
    const params = new URLSearchParams({ apiKey });
    if (input.q) params.set('q', String(input.q));
    if (input.companyName) params.set('companyName', String(input.companyName));
    if (input.from) params.set('from', String(input.from));
    if (input.sortBy) params.set('sortBy', String(input.sortBy));
    if (input.size != null) params.set('size', String(input.size));
    // Array fields as repeated params
    if (Array.isArray(input.sourceGroup)) {
      for (const v of input.sourceGroup) params.append('sourceGroup', v);
    }
    if (Array.isArray(input.excludeLabel)) {
      for (const v of input.excludeLabel) params.append('excludeLabel', v);
    }
    if (Array.isArray(input.category)) {
      for (const v of input.category) params.append('category', v);
    }

    const res = await fetch(`${PERIGON_BASE}/articles/all?${params}`);
    if (!res.ok) throw new Error(`Perigon articles HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  if (toolName === 'perigon_stories_all') {
    const params = new URLSearchParams({ apiKey });
    if (input.q) params.set('q', String(input.q));
    if (input.minUniqueSources != null) params.set('minUniqueSources', String(input.minUniqueSources));
    if (input.sortBy) params.set('sortBy', String(input.sortBy));
    if (input.size != null) params.set('size', String(input.size));
    if (Array.isArray(input.category)) {
      for (const v of input.category) params.append('category', v);
    }

    const res = await fetch(`${PERIGON_BASE}/stories/all?${params}`);
    if (!res.ok) throw new Error(`Perigon stories HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  if (toolName === 'perigon_vector_search') {
    const params = new URLSearchParams({ apiKey });
    const res = await fetch(`${PERIGON_BASE}/vector/news/all?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input.prompt, size: input.size }),
    });
    if (!res.ok) throw new Error(`Perigon vector HTTP ${res.status}: ${await res.text()}`);
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
      tools: PERIGON_TOOLS,
      toolRunner,
    });

    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = 0.008 * toolCalls;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;

    return {
      variant: VARIANT,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: 'Claude Sonnet 4.6 tokens + Perigon API calls',
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
        cost_basis: 'Claude Sonnet 4.6 tokens + Perigon API calls',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
