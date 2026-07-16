// Vendored from src/lib/query-planner.ts (origin/master commit 8bca690a)
// Changes: Redis replaced with in-memory Map stub, topic-engine curated list inlined

const planCache = new Map<string, { plan: ResolvedTopic; expiresAt: number }>();

export interface QueryInstruction {
  type: 'articles' | 'vector' | 'both';
  query: string;
  vectorQuery?: string;
  perigonCategory?: string;
  perigonTopic?: string;
  companyName?: string;
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

const PLAN_TTL_MS = 24 * 60 * 60 * 1000;

function getCachedPlan(topicName: string): ResolvedTopic | null {
  const entry = planCache.get(topicName.toLowerCase().trim());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { planCache.delete(topicName.toLowerCase().trim()); return null; }
  return entry.plan;
}

function setCachedPlan(topicName: string, plan: ResolvedTopic): void {
  planCache.set(topicName.toLowerCase().trim(), { plan, expiresAt: Date.now() + PLAN_TTL_MS });
}

const QUERY_PLANNER_SYSTEM_PROMPT = `You are a news search query planner. Given a list of user-selected news topics, produce an optimized search plan for each one.

You have two search endpoints:

ARTICLES SEARCH (type: "articles"): Keyword search. This is the DEFAULT and PREFERRED choice.
VECTOR SEARCH (type: "vector"): Semantic search with almost NO filtering. ONLY use when keyword matching fails.
BOTH (type: "both"): Runs articles AND vector in parallel for niche topics.

SPLITTING RULES: Split on distinct subjects joined by "and", "&", commas. Do NOT split when "and" is part of the concept name.

PERIGON CATEGORY FILTER: Valid: Auto, Business, Entertainment, Environment, Finance, Health, Lifestyle, Politics, Science, Sports, Tech, Travel, Weather, World. Only include when confident.

COMPANY NAME FILTER: Include companyName if the topic is clearly about a single company.

QUERY OPTIMIZATION: Use terms that news headlines contain. Use OR between alternatives. Quote multi-word phrases. 2-5 terms.

Output ONLY a valid JSON array:
[
  {
    "originalTopic": "AI and Tech",
    "queries": [
      { "type": "articles", "query": "\\"artificial intelligence\\" OR AI", "perigonCategory": "Tech" },
      { "type": "articles", "query": "technology OR startup", "perigonCategory": "Tech" }
    ]
  }
]`;

async function callQueryPlannerLLM(topicNames: string[]): Promise<QueryPlan[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUERY_PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: `Topics to plan: ${JSON.stringify(topicNames)}` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const outputText: string = data.choices?.[0]?.message?.content ?? '';
  if (!outputText) throw new Error('No output from query planner LLM');

  const cleaned = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart === -1 || arrEnd <= arrStart) throw new Error('No JSON array found in query planner response');
  return JSON.parse(cleaned.substring(arrStart, arrEnd + 1)) as QueryPlan[];
}

export async function resolveTopics(
  topics: { name: string }[],
  _opts?: { skipCache?: boolean },
): Promise<ResolvedTopic[]> {
  const resolved: ResolvedTopic[] = [];
  const needsPlanning: { index: number; name: string }[] = [];
  const result: ResolvedTopic[] = new Array(topics.length);

  for (let i = 0; i < topics.length; i++) {
    const name = topics[i].name;
    const cached = getCachedPlan(name);
    if (cached) {
      result[i] = cached;
    } else {
      needsPlanning.push({ index: i, name });
    }
  }

  if (needsPlanning.length > 0) {
    try {
      const plans = await callQueryPlannerLLM(needsPlanning.map((t) => t.name));
      for (let j = 0; j < needsPlanning.length; j++) {
        const { index, name } = needsPlanning[j];
        const plan = plans[j];
        const rt: ResolvedTopic = {
          displayName: name,
          queries: plan?.queries || [{ type: 'articles', query: name }],
        };
        setCachedPlan(name, rt);
        result[index] = rt;
      }
    } catch (err) {
      console.error('[master/query-planner] LLM failed, using fallback:', err);
      for (const { index, name } of needsPlanning) {
        result[index] = { displayName: name, queries: [{ type: 'articles', query: name }] };
      }
    }
  }

  return result.filter(Boolean);
}
