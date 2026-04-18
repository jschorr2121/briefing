// LLM-based query planner for the news pipeline.
//
// Turns a free-text user topic into a typed QueryPlan that the routing layer
// uses to choose the right Perigon endpoint and parameters.
//
// Cached for 30 days keyed on the normalized raw input — classification is
// stable, the same string should never re-spend an LLM token.

import { getOpenAIModel } from '../models';
import { getCached, setCached } from './cache';
import { normalizeTopic, shortHash } from './normalize';
import { log, logJson } from './logger';

// ─── Types ───────────────────────────────────────────────────────────

export type QueryShape = 'broad' | 'niche' | 'entity' | 'conceptual';

/** Subset of Perigon categories we map to. Free-form string at runtime. */
export type PerigonCategory =
  | 'Auto' | 'Business' | 'Entertainment' | 'Environment' | 'Finance'
  | 'Health' | 'Lifestyle' | 'Politics' | 'Science' | 'Sports'
  | 'Tech' | 'Travel' | 'Weather' | 'World';

export interface QueryPlan {
  /** The original raw user input, untouched. */
  rawInput: string;
  /** Lowercased / depunctuated form used for cache key collision. */
  normalizedQuery: string;
  /** 2–5 search terms (already OR-joined and quoted as needed) for Perigon `q`. */
  canonicalQuery: string;
  shape: QueryShape;
  category?: PerigonCategory;
  /** Perigon topic tag (e.g. "AI", "NFL", "Cryptocurrency"). */
  topic?: string;
  /** Single-company entity name when shape === "entity". */
  companyName?: string;
  /** Natural-language reformulation for vector fallback / conceptual search. */
  vectorPrompt?: string;
}

// ─── Cache ───────────────────────────────────────────────────────────

const PLAN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function planCacheKey(normalized: string): string {
  return `news:qp:v1:${shortHash(normalized)}`;
}

// ─── Prompt ──────────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You classify a single news topic the user typed into a structured query plan.

Output ONLY a valid JSON object with this exact shape (no markdown, no commentary):
{
  "canonicalQuery": "string",
  "shape": "broad" | "niche" | "entity" | "conceptual",
  "category": "Auto" | "Business" | "Entertainment" | "Environment" | "Finance" | "Health" | "Lifestyle" | "Politics" | "Science" | "Sports" | "Tech" | "Travel" | "Weather" | "World" | null,
  "topic": "string or null",
  "companyName": "string or null",
  "vectorPrompt": "string or null"
}

FIELD GUIDE:

canonicalQuery — 2-5 search terms optimized for a news search engine, joined by OR, with multi-word phrases double-quoted. Use vocabulary that news headlines actually contain.
  Examples:
    "AI"           → "\\"artificial intelligence\\" OR AI"
    "crypto"       → "cryptocurrency OR bitcoin OR ethereum"
    "Tesla"        → "Tesla OR \\"electric vehicles\\""
    "small modular reactors in Ontario" → "\\"small modular reactor\\" OR \\"SMR\\" OR Ontario nuclear"

shape — pick exactly one:
  "broad"      — well-known topic that maps cleanly to a Perigon category or topic and gets coverage from many outlets. Examples: AI, finance, NFL, climate change, politics.
  "niche"      — long-tail / specific keywords that are not a single named entity. Examples: HBM3 supply constraints, mRNA vaccine manufacturing, golf betting odds.
  "entity"     — a single named company, person, or product. Examples: Tesla, Sam Altman, Goldman Sachs, ChatGPT.
  "conceptual" — abstract topic with no consistent vocabulary; would not be matched well by literal keyword search. Examples: "AI safety culture shifts", "vibes around remote work".

category — pick exactly one Perigon category if the topic clearly fits, otherwise null. Be conservative.

topic — if the topic matches one of these Perigon topic tags, include it; otherwise null:
  AI, Cryptocurrency, Gaming, NFL, NBA, MLB, UFC, Tennis, Golf, Soccer, Formula 1, Space, Climate Change, Economy, Real Estate, Fitness, Parenting, Movies, Music

companyName — only if shape === "entity" AND the topic is a single named company. Use the official name (e.g. "Tesla", "Goldman Sachs"). Otherwise null.

vectorPrompt — only if shape === "conceptual". A natural-language description of what kind of articles to find. Otherwise null.

Be decisive. Pick one shape. No explanations.`;

interface RawPlannerOutput {
  canonicalQuery?: string;
  shape?: QueryShape;
  category?: PerigonCategory | null;
  topic?: string | null;
  companyName?: string | null;
  vectorPrompt?: string | null;
}

async function callPlannerLLM(rawInput: string): Promise<RawPlannerOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: `Topic: ${JSON.stringify(rawInput)}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Query planner LLM failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty response from query planner LLM');

  try {
    return JSON.parse(text) as RawPlannerOutput;
  } catch {
    // Best-effort recovery: locate the first {...} block.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('Query planner returned non-JSON output');
    }
    return JSON.parse(text.slice(start, end + 1)) as RawPlannerOutput;
  }
}

// ─── Fallback ────────────────────────────────────────────────────────

/** Heuristic plan used if the LLM fails or is misconfigured. */
function fallbackPlan(rawInput: string, normalized: string): QueryPlan {
  // Treat single-word capitalized inputs as entities, everything else as niche.
  const trimmed = rawInput.trim();
  const looksLikeEntity = /^[A-Z][a-zA-Z0-9.&'\- ]{1,40}$/.test(trimmed) && trimmed.split(/\s+/).length <= 3;
  return {
    rawInput,
    normalizedQuery: normalized,
    canonicalQuery: `"${trimmed.replace(/"/g, '')}"`,
    shape: looksLikeEntity ? 'entity' : 'niche',
    companyName: looksLikeEntity ? trimmed : undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/** Validate + coerce raw planner output, dropping nulls. */
function coerce(rawInput: string, normalized: string, raw: RawPlannerOutput): QueryPlan {
  const allowedShapes: QueryShape[] = ['broad', 'niche', 'entity', 'conceptual'];
  const shape = allowedShapes.includes(raw.shape as QueryShape) ? (raw.shape as QueryShape) : 'niche';

  const canonicalQuery =
    typeof raw.canonicalQuery === 'string' && raw.canonicalQuery.trim().length > 0
      ? raw.canonicalQuery.trim()
      : `"${rawInput.replace(/"/g, '')}"`;

  return {
    rawInput,
    normalizedQuery: normalized,
    canonicalQuery,
    shape,
    category: raw.category ?? undefined,
    topic: raw.topic ?? undefined,
    companyName: raw.companyName ?? undefined,
    vectorPrompt: raw.vectorPrompt ?? undefined,
  };
}

export async function getQueryPlan(rawInput: string): Promise<QueryPlan> {
  const normalized = normalizeTopic(rawInput);
  const cacheKey = planCacheKey(normalized);

  const cached = await getCached<QueryPlan>(cacheKey);
  if (cached) {
    log('query-planner', `Cache HIT for "${rawInput}" (normalized: "${normalized}")`);
    logJson('query-planner', 'Cached QueryPlan', cached);
    return cached;
  }

  log('query-planner', `Cache MISS for "${rawInput}" — calling LLM classifier`);
  let plan: QueryPlan;
  try {
    const raw = await callPlannerLLM(rawInput);
    logJson('query-planner', 'Raw LLM output', raw);
    plan = coerce(rawInput, normalized, raw);
  } catch (err) {
    console.error('[news/query-planner] LLM failed, using fallback:', err);
    log('query-planner', `LLM FAILED, using heuristic fallback`);
    plan = fallbackPlan(rawInput, normalized);
  }

  logJson('query-planner', 'Final QueryPlan', plan);
  await setCached(cacheKey, plan, PLAN_TTL_SECONDS);
  return plan;
}
