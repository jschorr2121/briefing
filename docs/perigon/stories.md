# Perigon Stories API

## Endpoint

### GET `/v1/stories/all`
Pre-clustered article groups — returns story clusters where multiple articles cover the same event/topic.

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Keyword query |
| `sortBy` | string | `"updatedAt"` | Sort order: `"updatedAt"`, `"createdAt"`, `"date"` |
| `size` | number | 10 | Results per page (0–100) |
| `page` | number | 0 | Page index |
| `from` | string | — | Start date (ISO format) |
| `to` | string | — | End date (ISO format) |
| `sourceGroup` | string[] | — | Source quality groups (e.g. `"top100"`) |
| `language` | string[] | — | Language codes (e.g. `"en"`) |
| `category` | string[] | — | Perigon taxonomy categories |
| `topic` | string[] | — | Perigon taxonomy topics |
| `minUniqueSources` | number | — | Minimum unique sources required per story cluster |
| `showDuplicates` | boolean | false | Return all duplicate story matches |

## Response Schema

```typescript
interface StoriesResponse {
  status: number;
  numResults: number;
  results: Story[];
}

interface Story {
  id: string;              // Story cluster ID (use as clusterId filter on articles/all)
  name: string;            // AI-generated story title
  summary?: string;
  shortSummary?: string;
  slug?: string;
  uniqueSources?: string[];  // Array of source domain strings
  uniqueCount?: number;      // Number of unique sources
  totalCount?: number;       // Total articles in cluster
  reprintCount?: number;
  selectedArticles?: Article[];  // May or may not be populated
  updatedAt: string;
  createdAt: string;
  topCategories?: { name: string }[];
  topTopics?: { name: string }[];
  topPeople?: { name: string }[];
  topCompanies?: { name: string }[];
}
```

## Usage Pattern

Stories are best for **broad, mainstream topics** that generate coverage from many outlets. The response gives a high-level view of what's happening in a topic area.

### Two-step pattern: Stories → Articles

1. Search stories to find clusters
2. Use cluster IDs to fetch full articles via `articles/all?clusterId=X`

```typescript
// Step 1: Find story clusters
const stories = await perigon.searchStories({
  q: "climate change",
  minUniqueSources: 5,
  sortBy: "updatedAt",
  size: 3,
});

// Step 2: Fetch articles for a specific cluster
const clusterArticles = await perigon.searchArticles({
  clusterId: [stories.results[0].id],
  size: 15,
});
```

## When to Use Stories vs Articles

| Use Stories | Use Articles |
|---|---|
| Broad topics (AI, NFL, crypto) | Niche company topics |
| High-volume news categories | Specific product queries |
| Major sports, politics, economy | Obscure subjects |
| Topics covered by many outlets | Very specific sub-topics |

## Examples

```typescript
// Basic story discovery
await perigon.searchStories({ q: "climate change", size: 5 });

// Trending stories with quality filter
const stories = await perigon.searchStories({
  q: "climate change",
  minUniqueSources: 5,
  sortBy: "updatedAt",
  size: 3,
});

// Market research with category filter
const trends = await perigon.searchStories({
  q: 'fintech OR "financial technology"',
  category: ["Business", "Tech"],
  minUniqueSources: 3,
});
```
