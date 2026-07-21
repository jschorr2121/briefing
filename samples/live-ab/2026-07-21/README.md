# Live A/B evidence — Jul 21, 2026

Raw captured outputs backing `docs/COST_ANALYSIS.md`. Produced by
`scripts/live-ab-compare.ts` against the real production code paths, with a
global-fetch interceptor recording every external call (exact token usage from
API `usage` fields, status, latency).

| File | Contents |
|---|---|
| `live-ab-results.json` | Main A/B: 6 approaches × 3 topics (agentic-nano, agentic-mini, brave, tavily†, exa, newsdata) — tokens, calls, latency, all gathered articles, assembled briefings |
| `live-ab-brave-v2.json` | Brave re-run after planner tuning (2 short queries) — the Finance quality fix |
| `live-ab-niche3.json` | Niche topics ("speedcubing", "artisanal fountain pen restoration") with the relevance gate + agentic fallback firing |
| `live-ab-niche4.json` | Niche re-run after sequential-query + 60s-timeout fixes |
| `url-checks.json` | HTTP status of every gathered URL from the main A/B (zero 404s; non-200s are bot-blocking 403/503) |

† Tavily rows are errors: the environment's `TAVILY_API_KEY` was invalid
(HTTP 401). No Tavily numbers are claimed anywhere.

Note: `live-ab-results.json` Brave/Finance rows predate the planner tuning and
contain the SEO-junk failure discussed in the analysis — kept deliberately as
the before/after evidence.
