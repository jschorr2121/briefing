import { Redis } from '@upstash/redis';
import { getOpenAIModel } from './models';
import { findCuratedTopic, type TopicConfig } from './topic-engine';

// ─── Types ───────────────────────────────────────────────────────────

export interface QueryInstruction {
  /** "articles" = /v1/articles/all, "vector" = /v1/vector/news/all, "both" = parallel merge */
  type: 'articles' | 'vector' | 'both';
  /** Keyword query for articles search, or prompt for vector search */
  query: string;
  /** Optional separate prompt for vector when type is "both" */
  vectorQuery?: string;
  /** Perigon taxonomy category filter (e.g. "Tech", "Sports", "Finance") */
  perigonCategory?: string;
  /** Perigon taxonomy topic filter (e.g. "AI", "NFL", "Cryptocurrency") — only use verified values */
  perigonTopic?: string;
  /** Company name for Perigon entity search (e.g. "Tesla", "Apple") */
  companyName?: string;
  /** Use /v1/stories/all endpoint for pre-clustered results (broad topics only) */
  useStories?: boolean;
}

export interface QueryPlan {
  originalTopic: string;
  queries: QueryInstruction[];
}

export interface ResolvedTopic {
  displayName: string;
  queries: QueryInstruction[];
}

// ─── Redis helpers ───────────────────────────────────────────────────

const PLAN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function planCacheKey(topicName: string): string {
  return `queryplan:topic:${topicName.toLowerCase().trim()}`;
}

async function getCachedPlan(topicName: string): Promise<QueryPlan | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const data = await redis.get<QueryPlan>(planCacheKey(topicName));
    return data ?? null;
  } catch (err) {
    console.error('Error reading query plan cache:', err);
    return null;
  }
}

async function setCachedPlan(topicName: string, plan: QueryPlan): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(planCacheKey(topicName), plan, { ex: PLAN_TTL_SECONDS });
  } catch (err) {
    console.error('Error writing query plan cache:', err);
  }
}

// ─── LLM Query Planner ──────────────────────────────────────────────

const QUERY_PLANNER_SYSTEM_PROMPT = `You are a news search query planner. Given a list of user-selected news topics, produce an optimized search plan for each one.

You have two search endpoints:

ARTICLES SEARCH (type: "articles"):
Keyword search across 150,000+ news sources. Returns individual articles with full metadata. This endpoint has powerful filtering: source quality groups, label exclusion (Opinion, Non-news, Paid News), category/topic filters, and relevance ranking.
- Use for: named entities (companies, people, products, brands), well-known topics, specific events, industry sectors, anything where articles would contain identifiable keywords.
- This is the DEFAULT and PREFERRED choice. The vast majority of topics should use "articles".

VECTOR SEARCH (type: "vector"):
Semantic search that finds articles by meaning. Has almost NO filtering — cannot filter by source quality, labels, or categories. Results often include opinion pieces, blog posts, and low-quality content.
- ONLY use when keyword matching would genuinely fail to find relevant articles.
- Rare examples: very abstract conceptual queries, topics described in natural language without consistent keywords.

BOTH (type: "both"):
Runs articles AND vector search in parallel, results are merged. Use for niche topics that are specific enough for keyword search but also benefit from semantic expansion.
- Good for: niche industry segments, specific divisions within companies, topics where relevant articles might use varied terminology.
- Optionally provide a vectorQuery that is more descriptive than the keyword query.

SPLITTING RULES:
- If a topic contains multiple DISTINCT subjects joined by "and", "&", commas, or similar connectors, SPLIT into separate queries. Each gets its own QueryInstruction.
  - "AI and Tech" -> two queries: one for AI, one for technology
  - "stocks and crypto" -> two queries: one for stock market, one for cryptocurrency
  - "NFL and NBA" -> two queries: one for NFL, one for NBA
- Do NOT split when "and" is part of the topic name or the words form a single concept:
  - "mergers and acquisitions" -> single query
  - "arts and entertainment" -> single query
  - "law and order" -> single query
  - "food and drink" -> single query
  - "science and technology" (as one field) -> single query
- Use judgment on ambiguous cases.

PERIGON CATEGORY FILTER:
For each query, optionally include a "perigonCategory" field to filter by Perigon's taxonomy.
Valid categories (use EXACTLY one of these strings, or omit if none fit):
Auto, Business, Entertainment, Environment, Finance, Health, Lifestyle, Politics, Science, Sports, Tech, Travel, Weather, World

Only include perigonCategory when you are confident it matches. Omit it for cross-category topics.

COMPANY NAME FILTER:
If the topic is clearly about a SPECIFIC company (e.g. "Tesla", "Apple", "Goldman Sachs"), include a "companyName" field with the company's official name. This enables precise entity matching. Omit for topics that aren't about a single company.

QUERY OPTIMIZATION:
- Optimize the query field for search — it does NOT need to match the user's exact wording.
- Use terms that news headlines would actually contain.
- Use OR between alternative search terms so articles matching ANY term are returned.
- Quote multi-word phrases with double quotes.
- Keep queries to 2-5 terms joined by OR.
- Examples:
  - "Claude AI" -> query: "\"Claude AI\" OR Anthropic"
  - "crypto" -> query: "cryptocurrency OR bitcoin OR ethereum"
  - "golf betting" -> query: "\"golf betting\" OR \"PGA odds\""
  - "Tesla" -> query: "Tesla OR \"electric vehicles\""
  - "housing market" -> query: "\"housing market\" OR \"real estate\" OR mortgage"

Output ONLY a valid JSON array. No markdown, no explanation:
[
  {
    "originalTopic": "AI and Tech",
    "queries": [
      { "type": "articles", "query": "\"artificial intelligence\" OR AI", "perigonCategory": "Tech" },
      { "type": "articles", "query": "technology OR startup", "perigonCategory": "Tech" }
    ]
  },
  {
    "originalTopic": "Morgan Stanley wealth management",
    "queries": [
      { "type": "both", "query": "\"Morgan Stanley\" OR \"wealth management\"", "vectorQuery": "Morgan Stanley wealth management division advisory private banking", "perigonCategory": "Finance" }
    ]
  },
  {
    "originalTopic": "Claude AI",
    "queries": [
      { "type": "articles", "query": "\"Claude AI\" OR Anthropic", "perigonCategory": "Tech" }
    ]
  }
]`;

async function callQueryPlannerLLM(topicNames: string[]): Promise<QueryPlan[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();
  const userMessage = `Topics to plan: ${JSON.stringify(topicNames)}`;

  async function callLLM(): Promise<QueryPlan[]> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: QUERY_PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI API error (${res.status}): ${body}`);
    }

    const data = await res.json();

    if (data.usage) {
      console.log(`📊 [QueryPlanner] Token usage — input: ${data.usage.prompt_tokens}, output: ${data.usage.completion_tokens}`);
    }

    const outputText: string = data.choices?.[0]?.message?.content ?? '';
    if (!outputText) throw new Error('No output from query planner LLM');

    // Parse JSON array from response
    const cleaned = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart === -1 || arrEnd <= arrStart) {
      throw new Error('No JSON array found in query planner response');
    }
    return JSON.parse(cleaned.substring(arrStart, arrEnd + 1));
  }

  // Try once, retry on parse failure
  try {
    return await callLLM();
  } catch (firstErr) {
    console.warn('⚠️ First query planner attempt failed:', firstErr);
    try {
      return await callLLM();
    } catch {
      // Fall back to basic articles query for each topic
      console.error('❌ Query planner failed after retry, using basic fallback');
      return topicNames.map(name => ({
        originalTopic: name,
        queries: [{ type: 'articles' as const, query: name }],
      }));
    }
  }
}

// ─── Convert curated config to QueryInstructions ─────────────────────

function curatedToInstructions(config: TopicConfig): QueryInstruction[] {
  const base: Partial<QueryInstruction> = {};
  if (config.perigonCategory) base.perigonCategory = config.perigonCategory;
  if (config.perigonTopic) base.perigonTopic = config.perigonTopic;
  if (config.type === 'broad') base.useStories = true;

  if (config.queryStrategy === 'articles') {
    return [{ type: 'articles', query: config.keywordQuery, ...base }];
  } else {
    // "both" strategy: keyword + semantic search in parallel
    return [{
      type: 'both',
      query: config.keywordQuery,
      vectorQuery: config.vectorPrompt,
      ...base,
    }];
  }
}

// ─── Main: resolve topics to query plans ─────────────────────────────

export async function resolveTopics(
  topics: { name: string }[],
  opts?: { skipCache?: boolean },
): Promise<ResolvedTopic[]> {
  const resolved: ResolvedTopic[] = [];
  const needsPlanning: { index: number; name: string }[] = [];

  // Step 1: Check curated topics and Redis cache
  for (let i = 0; i < topics.length; i++) {
    const name = topics[i].name;
    const curated = findCuratedTopic(name);

    if (curated) {
      console.log(`📋 Curated topic: "${name}" → ${curated.id}`);
      resolved.push({
        displayName: name,
        queries: curatedToInstructions(curated),
      });
      continue;
    }

    // Check Redis cache for plan (skip in dev mode)
    const cached = opts?.skipCache ? null : await getCachedPlan(name);
    if (cached) {
      console.log(`📦 Cached query plan for "${name}"`);
      resolved.push({
        displayName: name,
        queries: cached.queries,
      });
      continue;
    }

    // Needs LLM planning
    resolved.push({ displayName: name, queries: [] }); // placeholder
    needsPlanning.push({ index: i, name });
  }

  // Step 2: Send uncached, non-curated topics to LLM in one call
  if (needsPlanning.length > 0) {
    console.log(`🧠 Query planner: planning ${needsPlanning.length} topics via LLM`);
    const plans = await callQueryPlannerLLM(needsPlanning.map(t => t.name));

    // Match plans back to topics and cache them
    for (const entry of needsPlanning) {
      const plan = plans.find(
        p => p.originalTopic.toLowerCase().trim() === entry.name.toLowerCase().trim()
      );

      if (plan && plan.queries.length > 0) {
        resolved[entry.index] = {
          displayName: entry.name,
          queries: plan.queries,
        };
        await setCachedPlan(entry.name, plan);
      } else {
        // Fallback: basic articles query
        console.warn(`⚠️ No plan found for "${entry.name}", using basic fallback`);
        const fallbackPlan: QueryPlan = {
          originalTopic: entry.name,
          queries: [{ type: 'articles', query: entry.name }],
        };
        resolved[entry.index] = {
          displayName: entry.name,
          queries: fallbackPlan.queries,
        };
        await setCachedPlan(entry.name, fallbackPlan);
      }
    }
  }

  // Log the full query plan
  for (const r of resolved) {
    const querySummary = r.queries.map(q => {
      let s = `[${q.type}] "${q.query}"`;
      if (q.vectorQuery) s += ` (vector: "${q.vectorQuery}")`;
      return s;
    }).join(', ');
    console.log(`🔍 Query plan for "${r.displayName}": ${querySummary}`);
  }

  return resolved;
}
