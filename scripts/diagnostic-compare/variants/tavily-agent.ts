import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import { runAgentLoop } from '../agent-driver.js';
import { TAVILY_TOOLS, buildBriefingSystemPrompt } from '../briefing-prompt.js';

const VARIANT = 'tavily-agent';

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

export async function run(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  if (dryRun) return dryRunResult(topic);

  const t0 = Date.now();
  let totalCredits = 0;

  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error('Missing TAVILY_API_KEY env var');

    const authHeader = `Bearer ${apiKey}`;

    async function toolRunner(toolName: string, input: Record<string, unknown>): Promise<unknown> {
      if (toolName === 'tavily_search') {
        const credits = input.search_depth === 'advanced' ? 2 : 1;
        totalCredits += credits;

        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`Tavily search HTTP ${res.status}: ${await res.text()}`);
        return res.json();
      }

      if (toolName === 'tavily_extract') {
        totalCredits += 1;

        const res = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({ urls: input.urls }),
        });
        if (!res.ok) throw new Error(`Tavily extract HTTP ${res.status}: ${await res.text()}`);
        return res.json();
      }

      throw new Error(`Unknown tool: ${toolName}`);
    }

    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: TAVILY_TOOLS,
      toolRunner,
    });

    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = totalCredits * 0.008;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;

    return {
      variant: VARIANT,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: 'Claude Sonnet 4.6 tokens + Tavily API credits',
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
        cost_basis: 'Claude Sonnet 4.6 tokens + Tavily API credits',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
