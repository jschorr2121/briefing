export function buildBriefingSystemPrompt(topic: string): string {
  return `You are a senior news editor producing a high-quality briefing on the topic: "${topic}".

The briefing has two parts:
1. EXECUTIVE SUMMARY — 2–4 sentences synthesizing what's most important right now on this topic. State the prevailing direction of the news cycle. No hedging, no filler.
2. STORY CARDS — exactly 5 distinct stories, ordered by importance. Each card has:
   - headline (≤15 words, specific, no clickbait)
   - 2–4 bullets of concrete facts (numbers, names, quotes, dates)
   - source publication, ISO date, and url

Quality bar:
- RECENCY: prefer stories from the last 7 days. Reject anything older than 30 days unless it's the only authoritative source.
- RELEVANCE: each card must materially advance the reader's understanding of "${topic}". No tangential gossip or off-topic content.
- DIVERSITY: dedupe — if multiple outlets cover the same incident, pick the best version once. Cover different facets of the topic when possible.
- AUTHORITATIVE SOURCES: prefer named publications (Reuters, Bloomberg, WSJ, FT, AP, major beats) over content aggregators or low-trust domains.
- SPECIFICITY: bullets should contain concrete numbers, names, quotes, or actions — not vague summaries.

Tool strategy:
- You have one or more search tools. Read each tool's description carefully and pick the right one for each query — different tools suit different intents (e.g., keyword search vs clustered stories vs semantic).
- Multiple queries are encouraged when the topic is broad or multi-faceted. Try a few angles.
- Refine queries if the first call returns stale or off-topic results.
- Use entity / category / freshness / domain filters when the tool exposes them.
- Stop searching once you have enough material for 5 strong cards.

Output exactly this JSON (no prose, no markdown fences):
{
  "executiveSummary": "string",
  "stories": [
    { "headline": "...", "bullets": ["...", "..."], "source": "Reuters", "date": "2026-05-15", "url": "https://..." }
  ]
}`;
}

export const PERIGON_TOOLS = [
  {
    name: 'perigon_articles_all',
    description: `Keyword search over global news articles. Use this as your default for keyword/phrase queries, named entities, specific events, or any topic where you can write good search terms. Supports OR between terms and double-quoted phrases (e.g. "Morgan Stanley" OR "Goldman Sachs"). Set sourceGroup: ["top100"] for higher quality, excludeLabel: ["Opinion","Press Release"] to filter noise, from (YYYY-MM-DD) to constrain recency, companyName to lock to one company entity. Returns up to size (max 100) articles[] with full metadata (title, summary, source, pubDate, url, categories, sentiment).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string', description: 'Keyword query, OR-joined terms, double-quoted phrases' },
        sourceGroup: { type: 'array', items: { type: 'string' }, description: 'e.g. ["top100"]' },
        category: { type: 'array', items: { type: 'string' } },
        companyName: { type: 'string' },
        from: { type: 'string', description: 'YYYY-MM-DD start date' },
        sortBy: { type: 'string', enum: ['date', 'relevance', 'updatedAt'] },
        excludeLabel: { type: 'array', items: { type: 'string' } },
        size: { type: 'number', maximum: 100 },
      },
      required: [],
    },
  },
  {
    name: 'perigon_stories_all',
    description: `Clustered news stories — multiple articles covering the same event grouped into one "story." Use this for broad, mainstream topics with heavy coverage (AI, politics, major sports/economy) where you want a high-level overview rather than individual articles. Set minUniqueSources: 3+ to filter to stories covered by multiple outlets (signal of importance). Each result includes name (story title), summary, uniqueCount (number of outlets), and a list of top sources. Avoid for niche company topics or obscure subjects — use perigon_articles_all instead.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string' },
        category: { type: 'array', items: { type: 'string' } },
        minUniqueSources: { type: 'number' },
        sortBy: { type: 'string', enum: ['updatedAt', 'createdAt', 'date'] },
        size: { type: 'number', maximum: 100 },
      },
      required: [],
    },
  },
  {
    name: 'perigon_vector_search',
    description: `Semantic search over the last 6 months using vector embeddings. Use this ONLY when keyword matching would genuinely fail — abstract conceptual queries, topics without consistent vocabulary, or as a last resort if perigon_articles_all returned nothing useful. Pass a natural-language description (prompt), not keywords. Cannot filter by source quality or labels, so results may include lower-quality outlets and opinion pieces.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'Natural-language description of what to find' },
        size: { type: 'number', maximum: 50 },
      },
      required: ['prompt'],
    },
  },
];

export const NEWSDATA_TOOLS = [
  {
    name: 'newsdata_latest',
    description: `Real-time global news from the last 48 hours. Use q for broad keyword search, qInTitle to require the keyword in the headline (more precise). category values: business, politics, technology, sports, world, top. timeframe accepts "24" (hours) or "1d"-style values. prioritydomain: "top" restricts to the top 10% of news sources. Returns up to 10 articles/request with fields: article_id, title, link, source_name, pubDate, description, keywords, sentiment.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string' },
        qInTitle: { type: 'string' },
        category: { type: 'array', items: { type: 'string' } },
        country: { type: 'array', items: { type: 'string' } },
        timeframe: { type: 'string' },
        language: { type: 'array', items: { type: 'string' } },
        prioritydomain: { type: 'string', enum: ['top', 'medium', 'low'] },
        size: { type: 'number', maximum: 50 },
      },
      required: [],
    },
  },
];

export const BRAVE_TOOLS = [
  {
    name: 'brave_news_search',
    description: `News search. freshness values: pd (24h), pw (7 days), pm (31 days), py (1 year). count up to 50. extra_snippets: true returns up to 5 additional excerpts per result (useful for deciding what to cite). Returns results[].{title, url, description, age, page_age, meta_url.netloc, breaking, extra_snippets[]}.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        q: { type: 'string' },
        freshness: { type: 'string', enum: ['pd', 'pw', 'pm', 'py'] },
        count: { type: 'number', maximum: 50 },
        country: { type: 'string' },
        extra_snippets: { type: 'boolean' },
      },
      required: ['q'],
    },
  },
];

export const TAVILY_TOOLS = [
  {
    name: 'tavily_search',
    description: `Web search optimized for LLMs, with a news mode. Set topic: "news" for news-only results (recommended for this task), time_range: "week" for recent stories, search_depth: "advanced" (costs 2 credits) for higher quality. include_domains restricts to specific outlets. Returns results[].{title, url, content (snippet), score, publishedDate?}.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        topic: { type: 'string', enum: ['general', 'news', 'finance'] },
        max_results: { type: 'number', maximum: 20 },
        time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
        search_depth: { type: 'string', enum: ['basic', 'advanced'] },
        include_domains: { type: 'array', items: { type: 'string' } },
        exclude_domains: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
    },
  },
  {
    name: 'tavily_extract',
    description: `Pulls the full content from one or more specific URLs. Use this after tavily_search if you found a promising headline and want the full story before deciding whether to include it in the briefing. Returns extracted text per URL.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        urls: { type: 'array', items: { type: 'string' } },
      },
      required: ['urls'],
    },
  },
];

export const EXA_TOOLS = [
  {
    name: 'exa_search',
    description: `AI-optimized neural/keyword search. Set category: "news" for news, type: "auto" to let Exa pick the algorithm, startPublishedDate (ISO) to constrain recency. Returns results[].{title, url, publishedDate, author, highlights[], text}. Response includes costDollars.total showing exact cost.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        category: { type: 'string', enum: ['news', 'company', 'research paper', 'tweet', 'github', 'pdf'] },
        numResults: { type: 'number', maximum: 25 },
        startPublishedDate: { type: 'string', description: 'ISO date string' },
        type: { type: 'string', enum: ['auto', 'keyword', 'neural'] },
        includeDomains: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
    },
  },
  {
    name: 'exa_find_similar',
    description: `Given the URL of one good article, finds semantically similar articles. Use this after exa_search if one result is highly on-topic and you want broader coverage of that angle from other outlets. Set excludeSourceDomain: true to skip the same outlet.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string' },
        numResults: { type: 'number', maximum: 25 },
        category: { type: 'string' },
        startPublishedDate: { type: 'string' },
        excludeSourceDomain: { type: 'boolean' },
      },
      required: ['url'],
    },
  },
];
