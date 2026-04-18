# Perigon Vector Search API

## Endpoint

### POST `/v1/vector/news/all`
Semantic search that finds articles by meaning using vector embeddings (cosine similarity).

## Parameters

Passed as JSON body (POST request):

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | string | — | Natural language description of what to search for |
| `size` | number | 10 | Number of results to return |

**Important:** Vector search has almost NO filtering capabilities — cannot filter by source quality, labels, categories, or topics. Results often include opinion pieces and low-quality content.

## Response Schema

```typescript
interface VectorResponse {
  status: number;
  results: VectorResult[];
}

interface VectorResult {
  score: number;      // Cosine similarity score
  data: Article;      // Same Article schema as articles endpoint
}
```

## When to Use

- **ONLY** when keyword matching would genuinely fail to find relevant articles
- Very abstract conceptual queries
- Topics with no consistent keywords
- Topics with varied terminology that keyword search can't capture

## When NOT to Use

- Named entities (companies, people, products) — use articles search
- Specific events — use articles search
- Anything with identifiable keywords — use articles search
- When source quality matters — vector has no quality filtering

## Examples

```typescript
// Semantic article search
await perigon.vectorSearchArticles({
  articleSearchParams: {
    prompt: "advancements in AI",
    size: 5,
  },
});
```

## "Both" Strategy

For niche topics that benefit from semantic expansion, run articles AND vector search in parallel:

```typescript
// Parallel: keyword + semantic
const [articlesResult, vectorResult] = await Promise.allSettled([
  searchArticlesAll({ q: "fintech OR neobank", sourceGroup: ["top100"], size: 15 }),
  vectorSearchArticles({ prompt: "fintech neobank digital banking disruption", size: 15 }),
]);

// Merge and deduplicate results (prefer articles/all which have richer metadata)
```
