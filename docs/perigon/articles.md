# Perigon Articles API

## Endpoints

### GET `/v1/all` (Legacy)
Basic article search with taxonomy tag filtering.

### GET `/v1/articles/all` (Primary)
Full-featured article search with source groups, label exclusion, reprint dedup, and relevance ranking.

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Keyword query. Supports `OR` between terms, double-quoted phrases. |
| `sortBy` | string | `"date"` | Sort order: `"date"`, `"relevance"`, `"updatedAt"` |
| `size` | number | 10 | Results per page (0–100) |
| `page` | number | 0 | Page index |
| `from` | string | — | Start date (ISO format) |
| `to` | string | — | End date (ISO format) |
| `sourceGroup` | string[] | — | Source quality groups (e.g. `"top100"`) |
| `source` | string[] | — | Specific source domains (e.g. `"nytimes.com"`, `"reuters.com"`) |
| `excludeLabel` | string[] | — | Labels to exclude (e.g. `"Non-news"`, `"Opinion"`, `"Paid News"`, `"Press Release"`) |
| `showReprints` | boolean | true | Include reprint/syndicated articles |
| `category` | string[] | — | Perigon taxonomy categories (see taxonomy.md) |
| `topic` | string[] | — | Perigon taxonomy topics (see taxonomy.md) |
| `language` | string[] | — | Language codes (e.g. `"en"`) |
| `country` | string[] | — | Country codes |
| `medium` | string[] | — | Content medium (e.g. `"Article"`) |
| `companyName` | string | — | Filter by company entity name |
| `clusterId` | string[] | — | Filter articles by story cluster ID(s) (from stories/all endpoint) |

## Query Syntax

- `OR` between terms: `"artificial intelligence" OR AI`
- Double-quoted phrases: `"climate change"`
- Multiple terms: `technology OR startup OR innovation`
- Keep queries to 2-5 terms joined by OR for best results

## Response Schema

```typescript
interface ArticlesResponse {
  status: number;
  numResults: number;
  articles: Article[];
}

interface Article {
  title: string;
  url: string;
  source: {
    domain: string;
    name?: string;
    location?: { country?: string; city?: string };
  };
  pubDate: string;
  summary?: string;
  description?: string;
  content?: string;
  imageUrl?: string;
  topics?: { name: string }[];
  categories?: { name: string }[];
  labels?: { name: string }[];
  sentiment?: { positive: number; negative: number; neutral: number };
}
```

## Examples

```typescript
// Basic search
const { articles, numResults } = await perigon.searchArticles({
  q: "artificial intelligence",
  size: 5,
});

// Date range filter
await perigon.searchArticles({
  q: "business",
  from: "2025-04-01",
  to: "2025-04-08",
});

// Advanced filtering
const filtered = await perigon.searchArticles({
  q: "technology OR startup",
  source: ["reuters.com", "bloomberg.com"],
  category: ["Tech", "Business"],
  from: "2024-01-01",
  excludeLabel: ["Opinion"],
  size: 5,
});

// Company tracking
const mentions = await perigon.searchArticles({
  companyName: "Tesla",
  excludeLabel: ["Press Release"],
  sortBy: "date",
  size: 20,
});

// Restrict to specific source
await perigon.searchArticles({ source: ["nytimes.com"] });
```

## Source Groups

- `"top100"` — Perigon's curated list of ~100 top news sources. Same list across all topics. Good for quality filtering but excludes niche/specialty sources.
