# Perigon Entity Search APIs

## Companies

### GET `/v1/companies`
Search for company entities with structured data.

```typescript
const companies = await perigon.searchCompanies({
  q: "Tesla",
  size: 5,
});
```

Returns: CEO info, industry classification, and other structured company data.

## Journalists

### GET `/v1/journalists`
Search for journalists/reporters by name, publication, location, or coverage areas.

```typescript
// Search by name
const journalists = await perigon.searchJournalists({
  q: "John Smith",
  size: 5,
});

// Get by ID
const journalist = await perigon.getJournalistById("journalist-id");
```

## People

Public figure search with biographical data.

## Wikipedia

### GET `/v1/wikipedia`
Search Wikipedia pages by query with pageviews threshold and relevance sorting.

### POST `/v1/vector/wikipedia`
Semantic Wikipedia page retrieval.

```typescript
const wiki = await perigon.searchWikipedia({
  q: "quantum computing",
  size: 5,
});
```

## Using `companyName` on Articles Search

For tracking a specific company's news coverage:

```typescript
// Track competitor coverage
const competitor = await perigon.searchArticles({
  companyName: "CompetitorName",
  excludeLabel: ["Press Release"],
  from: "2025-01-01",
  sortBy: "date",
  size: 20,
});
```

The `companyName` parameter enables precise entity matching on the articles endpoint — it's more accurate than just including the company name in the `q` parameter.
