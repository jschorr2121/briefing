// Vendored from src/lib/briefing-generator.ts (origin/master commit 8bca690a)
// FETCH ONLY — LLM assembly removed. Returns raw prepared articles per topic.

import {
  searchArticlesAll,
  vectorSearchArticles,
  searchStories,
  filterVectorResults,
  deduplicateArticles,
  daysAgo,
  type PerigonArticle,
} from './perigon-client.js';
import { getCachedQueryArticles, setCachedQueryArticles, type PerigonResult } from './perigon-cache.js';
import { resolveTopics, type QueryInstruction, type ResolvedTopic } from './query-planner.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface PreparedArticle {
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
}

export interface TopicFetchResult {
  topic: string;
  articles: PreparedArticle[];
  cascadeStep: string;
  perigonCalls: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function interleaveArticles(groups: PerigonArticle[][]): PerigonArticle[] {
  const out: PerigonArticle[] = [];
  const maxLen = Math.max(...groups.map((g) => g.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.length) out.push(g[i]);
    }
  }
  return out;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function prepareArticles(rawArticles: PerigonArticle[], limit: number): PreparedArticle[] {
  return rawArticles.slice(0, limit).map((a) => ({
    title: a.title,
    source: a.source?.name || a.source?.domain || 'Unknown',
    date: formatDate(a.pubDate),
    summary: a.summary || a.description || '',
    url: a.url,
  }));
}

// ─── Cascade logic (verbatim from origin/master executeQuery) ─────────

interface ExecuteQueryResult {
  articles: PerigonArticle[];
  cascadeStep: string;
}

let _callCount = 0;

async function executeQuery(instruction: QueryInstruction): Promise<ExecuteQueryResult> {
  const { type, query, vectorQuery } = instruction;
  const taxonomyFilters = {
    ...(instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}),
    ...(instruction.perigonTopic ? { topic: [instruction.perigonTopic] } : {}),
    ...(instruction.companyName ? { companyName: instruction.companyName } : {}),
  };

  if (type === 'vector') {
    _callCount++;
    const result = await vectorSearchArticles({ prompt: query, size: 15 });
    return { articles: filterVectorResults(result.articles), cascadeStep: 'vector-only' };
  }

  if (type === 'both') {
    _callCount += 2;
    const [articlesResult, vectorResult] = await Promise.allSettled([
      searchArticlesAll({ q: query, sourceGroup: ['top100'], excludeLabel: ['Non-news', 'Opinion', 'Paid News'], showReprints: false, sortBy: 'relevance', size: 15, from: daysAgo(5), language: ['en'], medium: ['Article'], ...taxonomyFilters }),
      vectorSearchArticles({ prompt: vectorQuery || query, size: 15 }),
    ]);
    const articles: PerigonArticle[] = [];
    if (articlesResult.status === 'fulfilled') articles.push(...articlesResult.value.articles);
    if (vectorResult.status === 'fulfilled') articles.push(...filterVectorResults(vectorResult.value.articles));
    return { articles: deduplicateArticles(articles), cascadeStep: 'both-parallel' };
  }

  // type === 'articles': cascade
  if (instruction.useStories) {
    try {
      _callCount++;
      const stories = await searchStories({ q: query, size: 8, from: daysAgo(5), sourceGroup: ['top100'], sortBy: 'updatedAt', language: ['en'], ...(instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}), minUniqueSources: 3 });
      if (stories.results && stories.results.length >= 3) {
        const storyArticles: PerigonArticle[] = [];
        for (const story of stories.results) {
          const arts = story.articles || story.results || [];
          if (arts.length > 0) storyArticles.push(arts[0]);
        }
        if (storyArticles.length >= 3) return { articles: storyArticles, cascadeStep: 'stories-clustered' };
      }
    } catch (err) {
      console.warn('[master/briefing-generator] Stories failed, continuing:', err);
    }
  }

  // Step 1: top100, 5 days
  _callCount++;
  const step1 = await searchArticlesAll({ q: query, sourceGroup: ['top100'], excludeLabel: ['Non-news', 'Opinion', 'Paid News'], showReprints: false, sortBy: 'relevance', size: 20, from: daysAgo(5), language: ['en'], medium: ['Article'], ...taxonomyFilters });
  if (step1.articles.length >= 3) return { articles: step1.articles, cascadeStep: 'step1-top100-5d' };

  // Step 2: all sources, 7 days
  _callCount++;
  const step2 = await searchArticlesAll({ q: query, excludeLabel: ['Non-news', 'Opinion', 'Paid News'], showReprints: false, sortBy: 'relevance', size: 20, from: daysAgo(7), language: ['en'], medium: ['Article'], ...taxonomyFilters });
  if (step2.articles.length >= 3) return { articles: step2.articles, cascadeStep: 'step2-allsources-7d' };

  // Step 3: vector fallback
  _callCount++;
  const step3 = await vectorSearchArticles({ prompt: query, size: 15 });
  return { articles: filterVectorResults(step3.articles), cascadeStep: 'step3-vector-fallback' };
}

async function fetchQueryArticles(instruction: QueryInstruction, skipCache = false): Promise<{ articles: PerigonArticle[]; cascadeStep: string }> {
  if (!skipCache) {
    const cached = await getCachedQueryArticles(instruction.type, instruction.query);
    if (cached) return { articles: cached.data.articles, cascadeStep: 'cached' };
  }
  const { articles, cascadeStep } = await executeQuery(instruction);
  const result: PerigonResult = { data: { status: 200, numResults: articles.length, articles } };
  await setCachedQueryArticles(instruction.type, instruction.query, result);
  return { articles, cascadeStep };
}

async function fetchArticlesForTopic(resolved: ResolvedTopic): Promise<TopicFetchResult> {
  _callCount = 0;
  const queryResults = await Promise.all(resolved.queries.map((q) => fetchQueryArticles(q, true)));
  const cascadeSteps = queryResults.map((r) => r.cascadeStep);
  const rawArticles = queryResults.map((r) => r.articles);
  const interleaved = interleaveArticles(rawArticles);
  const deduped = deduplicateArticles(interleaved).slice(0, 12);
  return {
    topic: resolved.displayName,
    articles: prepareArticles(deduped, 12),
    cascadeStep: cascadeSteps.join(', '),
    perigonCalls: _callCount,
  };
}

// ─── Public API ───────────────────────────────────────────────────────

export interface MasterFetchResult {
  topics: TopicFetchResult[];
  totalPerigonCalls: number;
}

export async function fetchArticlesForTopics(topicNames: string[]): Promise<MasterFetchResult> {
  const resolved = await resolveTopics(topicNames.map((name) => ({ name })));
  let totalPerigonCalls = 0;
  const topics: TopicFetchResult[] = [];

  for (const r of resolved) {
    const result = await fetchArticlesForTopic(r);
    topics.push(result);
    totalPerigonCalls += result.perigonCalls;
  }

  return { topics, totalPerigonCalls };
}
