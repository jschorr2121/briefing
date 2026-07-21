// Live A/B: agentic web_search TOOL gathering vs direct search-API gathering.
//
// Runs the SAME topics through each approach using the real production code
// paths (src/lib/agentic-fetcher.ts and src/lib/search-fetcher.ts), then the
// real assembly prompts, and records per-run: exact token usage (from API
// usage fields), external API call counts, latency, and the gathered
// articles themselves for quality inspection.
//
//   npx tsx scripts/live-ab-compare.ts [--out results.json] [--approaches a,b]
//
// Requires OPENAI_API_KEY plus whichever provider keys you want compared
// (BRAVE_API_KEY, TAVILY_API_KEY, EXA_API_KEY, NEWSDATA_API_KEY). Approaches
// whose key is missing are skipped and marked so.
//
// Redis credentials are cleared at startup ON PURPOSE: measurement must
// never write to (or read from) the production cache real users share.

const OUT_ARG = process.argv.indexOf('--out');
const OUT_PATH = OUT_ARG !== -1 ? process.argv[OUT_ARG + 1] : 'live-ab-results.json';
const APPROACH_ARG = process.argv.indexOf('--approaches');
const ONLY_APPROACHES = APPROACH_ARG !== -1 ? process.argv[APPROACH_ARG + 1].split(',') : null;
const TOPICS_ARG = process.argv.indexOf('--topics');

// Isolate from production cache BEFORE any lib import runs getRedis().
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.KV_URL;
delete process.env.REDIS_URL;

import * as fs from 'fs';
import { fetchArticlesViaWebSearch } from '../src/lib/agentic-fetcher';
import { fetchArticlesViaSearchApi } from '../src/lib/search-fetcher';
import { buildPerigonAssemblyPrompt, buildPerigonUserMessage, type PreparedArticle } from '../src/lib/prompts';

const TOPICS = TOPICS_ARG !== -1 ? process.argv[TOPICS_ARG + 1].split(',') : ['AI & Tech', 'World News', 'Finance'];

// ─── Fetch interceptor: exact usage + call counts ────────────────────

interface RecordedCall {
  host: string;
  path: string;
  status: number;
  ms: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  webSearchToolCalls?: number;
}

let recorded: RecordedCall[] = [];
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const t0 = Date.now();
  const res = await realFetch(input as RequestInfo, init);
  const rec: RecordedCall = {
    host: url.hostname,
    path: url.pathname,
    status: res.status,
    ms: Date.now() - t0,
  };
  if (url.hostname === 'api.openai.com' && res.ok) {
    try {
      const clone = res.clone();
      const data = await clone.json();
      rec.model = data.model;
      if (data.usage) {
        rec.inputTokens = data.usage.input_tokens ?? data.usage.prompt_tokens;
        rec.outputTokens = data.usage.output_tokens ?? data.usage.completion_tokens;
      }
      if (Array.isArray(data.output)) {
        rec.webSearchToolCalls = data.output.filter((o: { type?: string }) => o.type === 'web_search_call').length;
      }
    } catch {
      // non-JSON body; leave usage empty
    }
  }
  recorded.push(rec);
  return res;
}) as typeof fetch;

// ─── Assembly (real prompts, no cache writes) ────────────────────────

async function assemble(topicName: string, articles: PreparedArticle[]): Promise<{ summary: string; stories: unknown[] }> {
  const res = await realFetch.call(globalThis, 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-nano',
      messages: [
        { role: 'system', content: buildPerigonAssemblyPrompt(topicName) },
        { role: 'user', content: buildPerigonUserMessage(topicName, articles) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`assembly HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  recorded.push({
    host: 'api.openai.com',
    path: '/v1/chat/completions#assembly',
    status: res.status,
    ms: 0,
    model: data.model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    return JSON.parse(text.substring(start, end + 1));
  } catch {
    return { summary: text.substring(0, 200), stories: [] };
  }
}

// ─── Approaches ──────────────────────────────────────────────────────

interface Approach {
  name: string;
  requiredEnv: string[];
  setup: () => void;
  gather: (topic: string) => Promise<{ articles: PreparedArticle[]; cascadeStep?: string }>;
}

const APPROACHES: Approach[] = [
  {
    name: 'agentic-nano',
    requiredEnv: ['OPENAI_API_KEY'],
    setup: () => { process.env.BRIEFING_MODEL = 'gpt-5.4-nano'; },
    gather: async t => {
      const r = await fetchArticlesViaWebSearch(t, true);
      return { articles: r.articles, cascadeStep: r.debugInfo?.cascadeStep };
    },
  },
  {
    name: 'agentic-mini',
    requiredEnv: ['OPENAI_API_KEY'],
    setup: () => { process.env.BRIEFING_MODEL = 'gpt-5.4-mini'; },
    gather: async t => {
      const r = await fetchArticlesViaWebSearch(t, true);
      return { articles: r.articles, cascadeStep: r.debugInfo?.cascadeStep };
    },
  },
  ...(['brave', 'tavily', 'exa', 'newsdata'] as const).map(provider => ({
    name: `search-${provider}`,
    requiredEnv: ['OPENAI_API_KEY', `${provider.toUpperCase()}_API_KEY`],
    setup: () => {
      process.env.SEARCH_API_PROVIDER = provider;
      process.env.SEARCH_PLANNER_MODEL = 'gpt-5.4-nano';
    },
    gather: async (t: string) => {
      const r = await fetchArticlesViaSearchApi(t, true);
      return { articles: r.articles, cascadeStep: r.debugInfo?.cascadeStep };
    },
  })),
];

// ─── Main ────────────────────────────────────────────────────────────

interface RunResult {
  approach: string;
  topic: string;
  ok: boolean;
  error?: string;
  cascadeStep?: string;
  gatherMs: number;
  assembleMs: number;
  articleCount: number;
  articles: PreparedArticle[];
  assembled?: { summary: string; stories: unknown[] };
  calls: RecordedCall[];
  tokens: { gatherIn: number; gatherOut: number; assembleIn: number; assembleOut: number; webSearchToolCalls: number };
  searchApiCalls: number;
}

async function main() {
  const results: RunResult[] = [];

  for (const approach of APPROACHES) {
    if (ONLY_APPROACHES && !ONLY_APPROACHES.includes(approach.name)) continue;
    const missing = approach.requiredEnv.filter(k => !process.env[k]);
    if (missing.length > 0) {
      console.log(`⏭️  ${approach.name}: NOT RUNNABLE (missing ${missing.join(', ')})`);
      continue;
    }

    for (const topic of TOPICS) {
      approach.setup();
      recorded = [];
      console.log(`\n▶️  ${approach.name} × "${topic}"`);
      const t0 = Date.now();
      try {
        const { articles, cascadeStep } = await approach.gather(topic);
        const gatherMs = Date.now() - t0;
        const gatherCalls = [...recorded];

        const tA = Date.now();
        const assembled = articles.length > 0 ? await assemble(topic, articles) : { summary: '', stories: [] };
        const assembleMs = Date.now() - tA;

        const gatherLLM = gatherCalls.filter(c => c.host === 'api.openai.com');
        const assemblyCalls = recorded.filter(c => c.path.endsWith('#assembly'));
        const searchApiCalls = gatherCalls.filter(c => c.host !== 'api.openai.com').length;

        const sum = (arr: RecordedCall[], f: (c: RecordedCall) => number | undefined) =>
          arr.reduce((s, c) => s + (f(c) ?? 0), 0);

        results.push({
          approach: approach.name,
          topic,
          ok: true,
          cascadeStep,
          gatherMs,
          assembleMs,
          articleCount: articles.length,
          articles,
          assembled,
          calls: recorded,
          tokens: {
            gatherIn: sum(gatherLLM, c => c.inputTokens),
            gatherOut: sum(gatherLLM, c => c.outputTokens),
            assembleIn: sum(assemblyCalls, c => c.inputTokens),
            assembleOut: sum(assemblyCalls, c => c.outputTokens),
            webSearchToolCalls: sum(gatherLLM, c => c.webSearchToolCalls),
          },
          searchApiCalls,
        });
        const last = results[results.length - 1];
        console.log(
          `   ✅ ${last.articleCount} articles in ${gatherMs}ms | gather tokens ${last.tokens.gatherIn}in/${last.tokens.gatherOut}out | web_search calls ${last.tokens.webSearchToolCalls} | search API calls ${last.searchApiCalls} | assemble ${last.tokens.assembleIn}in/${last.tokens.assembleOut}out`
        );
      } catch (err) {
        results.push({
          approach: approach.name,
          topic,
          ok: false,
          error: String(err),
          gatherMs: Date.now() - t0,
          assembleMs: 0,
          articleCount: 0,
          articles: [],
          calls: recorded,
          tokens: { gatherIn: 0, gatherOut: 0, assembleIn: 0, assembleOut: 0, webSearchToolCalls: 0 },
          searchApiCalls: 0,
        });
        console.log(`   ❌ ${String(err).substring(0, 300)}`);
      }
      // NewsData free tier rate-limits aggressively; be gentle between runs.
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\n💾 Wrote ${results.length} runs to ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
