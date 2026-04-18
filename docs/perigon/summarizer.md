# Perigon Summarizer API

## Endpoint

### POST `/v1/summarize`
AI-generated summary of search results. May not be available on all API tiers.

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | string (body) | — | Topic/question to summarize |
| `q` | string (query) | — | Optional keyword query to scope results |
| `size` | number (query) | — | Number of articles to consider for summary |

## Response Schema

```typescript
interface SummarizerResponse {
  summary: string;
}
```

## Examples

```typescript
const { summary } = await perigon.searchSummarizer({
  q: "renewable energy",
  size: 10,
});
console.log(summary);
```
