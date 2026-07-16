import { type QueryInstruction, type ResolvedTopic } from './query-planner';
import { searchArticlesAll, vectorSearchArticles, searchStories, type PerigonArticle } from './perigon';
import { getCachedQueryArticles, setCachedQueryArticles, type PerigonResult } from './perigon-cache';
import { type PreparedArticle } from './prompts';

// ─── Exported intermediate types ─────────────────────────────────────

export interface QueryResult {
  articles: PerigonArticle[];
  cascadeStep: string;
}

export interface ArticleSet {
  articles: PreparedArticle[];
  debugInfo: {
    queries: { type: string; query: string; vectorQuery?: string }[];
    articleCount: number;
    cascadeStep: string;
  };
}

// ─── Article preparation helpers ─────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function prepareArticles(rawArticles: PerigonArticle[], limit: number): PreparedArticle[] {
  return rawArticles.slice(0, limit).map(a => ({
    title: a.title,
    source: a.source?.name || a.source?.domain || 'Unknown',
    date: formatDate(a.pubDate),
    summary: a.summary || a.description || '',
    url: a.url,
  }));
}

/** Deduplicate articles by URL, preferring earlier entries (higher quality/relevance) */
export function deduplicateArticles(articles: PerigonArticle[]): PerigonArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/** Interleave articles from multiple query results for balanced coverage */
export function interleaveArticles(queryResults: PerigonArticle[][]): PerigonArticle[] {
  if (queryResults.length === 0) return [];
  if (queryResults.length === 1) return queryResults[0];

  const result: PerigonArticle[] = [];
  const maxLen = Math.max(...queryResults.map(r => r.length));

  for (let i = 0; i < maxLen; i++) {
    for (const articles of queryResults) {
      if (i < articles.length) {
        result.push(articles[i]);
      }
    }
  }

  return result;
}

// ─── Days-ago helper ─────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── Vector result post-filter ───────────────────────────────────────
// Vector search has no server-side filtering, so we filter client-side.

const VECTOR_MAX_AGE_DAYS = 7;
const EXCLUDED_LABELS = new Set(['Non-news', 'Opinion', 'Paid News', 'Press Release', 'Low Content']);

function filterVectorResults(articles: PerigonArticle[]): PerigonArticle[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - VECTOR_MAX_AGE_DAYS);

  return articles.filter(a => {
    // Filter out old articles
    if (a.pubDate) {
      const pubDate = new Date(a.pubDate);
      if (!isNaN(pubDate.getTime()) && pubDate < cutoff) return false;
    }
    // Filter out excluded labels (Perigon returns these in the `labels` field)
    if (a.labels) {
      for (const label of a.labels) {
        if (EXCLUDED_LABELS.has(label.name)) return false;
      }
    }
    return true;
  });
}

// ─── Cascade fallback for a single QueryInstruction ──────────────────

export async function executeQuery(instruction: QueryInstruction): Promise<QueryResult> {
  const { type, query, vectorQuery } = instruction;

  // Taxonomy + entity filters (from curated topics or LLM planner)
  const taxonomyFilters = {
    ...(instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}),
    ...(instruction.perigonTopic ? { topic: [instruction.perigonTopic] } : {}),
    ...(instruction.companyName ? { companyName: instruction.companyName } : {}),
  };

  if (type === 'vector') {
    const result = await vectorSearchArticles({ prompt: query, size: 15 });
    return { articles: filterVectorResults(result.articles), cascadeStep: 'vector-only' };
  }

  if (type === 'both') {
    // Run articles and vector in parallel
    const [articlesResult, vectorResult] = await Promise.allSettled([
      searchArticlesAll({
        q: query,
        sourceGroup: ['top100'],
        excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
        showReprints: false,
        sortBy: 'relevance',
        size: 15,
        from: daysAgo(5),
        language: ['en'],
        medium: ['Article'],
        ...taxonomyFilters,
      }),
      vectorSearchArticles({ prompt: vectorQuery || query, size: 15 }),
    ]);

    const articles: PerigonArticle[] = [];
    if (articlesResult.status === 'fulfilled') articles.push(...articlesResult.value.articles);
    if (vectorResult.status === 'fulfilled') articles.push(...filterVectorResults(vectorResult.value.articles));

    // Deduplicate, preferring articles/all results (listed first, have richer metadata)
    return { articles: deduplicateArticles(articles), cascadeStep: 'both-parallel' };
  }

  // type === 'articles': cascade fallback

  // Step 0 (broad topics only): try stories endpoint for pre-clustered results
  if (instruction.useStories) {
    try {
      const stories = await searchStories({
        q: query,
        size: 8,
        from: daysAgo(5),
        sourceGroup: ['top100'],
        sortBy: 'updatedAt',
        language: ['en'],
        ...(instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}),
        ...(instruction.perigonTopic ? { topic: [instruction.perigonTopic] } : {}),
        minUniqueSources: 3,
      });

      if (stories.results && stories.results.length >= 3) {
        // Extract the first (best) article from each story cluster
        const storyArticles: PerigonArticle[] = [];
        for (const story of stories.results) {
          if (story.articles && story.articles.length > 0) {
            storyArticles.push(story.articles[0]);
          }
        }
        if (storyArticles.length >= 3) {
          console.log(`📰 Stories endpoint returned ${storyArticles.length} clustered articles for "${query}"`);
          return { articles: storyArticles, cascadeStep: 'stories-clustered' };
        }
      }
      console.log(`📉 Stories returned ${stories.results?.length ?? 0} results for "${query}", falling through to articles...`);
    } catch (err) {
      console.warn(`⚠️ Stories endpoint failed for "${query}", falling through:`, err);
    }
  }

  // Step 1: top100 sources, 5-day window
  const step1 = await searchArticlesAll({
    q: query,
    sourceGroup: ['top100'],
    excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
    showReprints: false,
    sortBy: 'relevance',
    size: 20,
    from: daysAgo(5),
    language: ['en'],
    medium: ['Article'],
    ...taxonomyFilters,
  });

  if (step1.articles.length >= 3) {
    return { articles: step1.articles, cascadeStep: 'step1-top100-5d' };
  }
  console.log(`📉 Step 1 returned ${step1.articles.length} articles for "${query}", broadening...`);

  // Step 2: drop sourceGroup, extend to 7 days
  const step2 = await searchArticlesAll({
    q: query,
    excludeLabel: ['Non-news', 'Opinion', 'Paid News'],
    showReprints: false,
    sortBy: 'relevance',
    size: 20,
    from: daysAgo(7),
    sourceGroup: [], // empty = no filter
    language: ['en'],
    medium: ['Article'],
    ...taxonomyFilters,
  });

  if (step2.articles.length >= 3) {
    return { articles: step2.articles, cascadeStep: 'step2-allsources-7d' };
  }
  console.log(`📉 Step 2 returned ${step2.articles.length} articles for "${query}", falling back to vector...`);

  // Step 3: vector search as last resort
  const step3 = await vectorSearchArticles({ prompt: query, size: 15 });
  return { articles: filterVectorResults(step3.articles), cascadeStep: 'step3-vector-fallback' };
}

// ─── Fetch articles for a single QueryInstruction (with caching) ─────

export async function fetchQueryArticles(instruction: QueryInstruction, skipCache = false): Promise<QueryResult> {
  const cacheType = instruction.type;
  const cacheQuery = instruction.query;

  // Check cache (skip in dev mode)
  if (!skipCache) {
    const cached = await getCachedQueryArticles(cacheType, cacheQuery);
    if (cached) {
      console.log(`📦 Cache hit for query "${cacheQuery}" (${cacheType})`);
      return { articles: cached.data.articles, cascadeStep: 'cached' };
    }
  }

  // Execute query with cascade fallback
  const { articles, cascadeStep } = await executeQuery(instruction);

  // Cache the result
  const result: PerigonResult = {
    data: { status: 200, numResults: articles.length, articles },
  };
  await setCachedQueryArticles(cacheType, cacheQuery, result);

  return { articles, cascadeStep };
}

// ─── Fetch & merge all queries for a topic ───────────────────────────

export async function fetchArticlesForTopic(resolved: ResolvedTopic, skipCache = false): Promise<ArticleSet> {
  // Fetch all queries in parallel
  const queryResults = await Promise.all(
    resolved.queries.map(q => fetchQueryArticles(q, skipCache))
  );

  // Collect debug info
  const debugQueries = resolved.queries.map(q => ({
    type: q.type,
    query: q.query,
    vectorQuery: q.vectorQuery,
  }));
  const cascadeSteps = queryResults.map(r => r.cascadeStep);

  // Interleave results from multiple queries for balanced coverage
  const rawArticles = queryResults.map(r => r.articles);
  const interleaved = interleaveArticles(rawArticles);

  // Deduplicate and take top 12 (more material for LLM assembly)
  const deduped = deduplicateArticles(interleaved);
  const top = deduped.slice(0, 12);

  return {
    articles: prepareArticles(top, 12),
    debugInfo: {
      queries: debugQueries,
      articleCount: top.length,
      cascadeStep: cascadeSteps.join(', '),
    },
  };
}
