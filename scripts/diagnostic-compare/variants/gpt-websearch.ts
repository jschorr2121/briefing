import type { VariantResult } from '../types.js';
import type { TopicConfig } from '../topics.js';
import type { BriefingResult } from '../types.js';
import { buildBriefingSystemPrompt } from '../briefing-prompt.js';

const VARIANT = 'gpt-4o-websearch';

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

function parseBriefingJson(text: string): BriefingResult {
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      executiveSummary: parsed.executiveSummary || '',
      cards: (parsed.stories || []).slice(0, 5).map((s: Record<string, unknown>) => ({
        headline: (s.headline as string) || 'Untitled',
        bullets: (s.bullets as string[]) || [],
        source: (s.source as string) || 'Unknown',
        date: (s.date as string) || '',
        url: (s.url as string) || '',
      })),
    };
  } catch {
    return { executiveSummary: '', cards: [] };
  }
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

interface OutputContentBlock {
  type: string;
  text?: string;
}

interface OutputItem {
  type: string;
  role?: string;
  content?: OutputContentBlock[];
}

interface OpenAIResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface OpenAIResponsesResponse {
  output?: OutputItem[];
  output_text?: string;
  usage?: OpenAIResponsesUsage;
  error?: { message?: string };
}

function extractOutputText(data: OpenAIResponsesResponse): string {
  // Prefer shorthand field if present
  if (data.output_text) return data.output_text;
  // Fall back to iterating output array for the last assistant message text
  if (Array.isArray(data.output)) {
    for (let i = data.output.length - 1; i >= 0; i--) {
      const item = data.output[i];
      if (item.type === 'message' && item.role === 'assistant' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.text) return block.text;
        }
      }
    }
  }
  return '';
}

export async function run(
  topic: string,
  config: TopicConfig,
  dryRun: boolean,
): Promise<VariantResult> {
  if (dryRun) return dryRunResult(topic);

  const t0 = Date.now();
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY env var');

    const systemPrompt = buildBriefingSystemPrompt(topic);

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        instructions: systemPrompt,
        input: `Topic: ${topic}`,
        tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Responses API HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as OpenAIResponsesResponse;
    const latency_ms = Date.now() - t0;

    if (data.error?.message) {
      throw new Error(`OpenAI API error: ${data.error.message}`);
    }

    const outputText = extractOutputText(data);
    const briefing = parseBriefingJson(outputText);
    const urls = briefing.cards.map((c) => c.url).filter(Boolean);

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;

    // Cost: $2.50/1M input + $10/1M output for gpt-4o
    const totalCost = (inputTokens * 2.5) / 1_000_000 + (outputTokens * 10) / 1_000_000;

    return {
      variant: VARIANT,
      topic,
      briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: 'gpt-4o tokens ($2.50/1M input, $10/1M output)',
        results_count: briefing.cards.length,
        unique_domains: countUniqueDomains(urls),
        tokens: { input: inputTokens, output: outputTokens },
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
        cost_basis: 'gpt-4o tokens ($2.50/1M input, $10/1M output)',
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}
