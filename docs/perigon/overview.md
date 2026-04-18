# Perigon API Overview

Base URL: `https://api.perigon.io/v1`

Authentication: API key passed as `apiKey` query parameter.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/v1/all` | GET | Legacy article search with taxonomy tags |
| `/v1/articles/all` | GET | Primary article search with full filtering |
| `/v1/stories/all` | GET | Pre-clustered story groups |
| `/v1/vector/news/all` | POST | Semantic/vector article search |
| `/v1/summarize` | POST | AI-generated summary of search results |
| `/v1/companies` | GET | Company entity search |
| `/v1/journalists` | GET | Journalist/reporter search |
| `/v1/topics` | GET | Browse available taxonomy topics |
| `/v1/wikipedia` | GET | Wikipedia page search |
| `/v1/vector/wikipedia` | POST | Semantic Wikipedia search |

## Pagination

All list endpoints support:
- `page` — Page index (0-based)
- `size` — Results per page (0–100, default 10)

## Date Filtering

- `from` — Start date (ISO 8601 format, e.g. `2025-04-01`)
- `to` — End date (ISO 8601 format)

## Language

- `language` — Array of ISO 639-1 codes (e.g. `en`, `es`, `fr`)
