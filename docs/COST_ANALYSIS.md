# Gather Cost Analysis — Search APIs vs LLM Web-Search Tools (July 21, 2026)

Decision record for `NEWS_SOURCE=search-api` (`src/lib/search-fetcher.ts`) and the
cross-user cache improvements in `src/lib/news/cache.ts`.

## TL;DR

**Gathering via a search API we call ourselves (Brave News, $5/1k requests) with a
cheap LLM only for query planning + assembly costs ~$0.035 per 3-topic briefing —
vs $0.077 for the current agentic path on gpt-5.4-nano (2.2×) and $1.167 on
claude-sonnet-5 (33×).** The saving comes from controlling what enters the model's
context: the LLM web-search *tool* feeds full page content into the context and
bills $10/1k tool calls on top; the search *API* returns titles + snippets that we
cap at 400 chars before any LLM sees them. On top of that, the topic cache now
actually coalesces concurrent identical requests (it didn't before), and
semantically-equivalent topics share one cache entry.

## What was actually measured, and what wasn't

This analysis was produced in an environment with **no API keys** (no
`OPENAI_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `NEWSDATA_API_KEY`,
no Upstash credentials, no `.env.local`). Live gather runs were therefore **not
runnable here**. Per-approach status:

| Evidence | Status |
|---|---|
| Diagnostic harness (`scripts/diagnostic-compare/`) | Executed in `--dry-run --skip-agent` mode only — verified it runs end-to-end and writes `output/*.md` + `metrics.json`. Live variants not runnable (no keys). |
| Agentic-path cost baseline (gpt-5.4-nano $0.077, -mini $0.190, gpt-5.4 $0.275, claude-sonnet-5 $1.167 per 3-topic briefing; Sonnet ~422K gather input tokens) | **Measured in last week's live session; numbers are not committed to the repo and could not be re-run here.** Arithmetic independently re-verified against published pricing below — see "Re-verifying the baseline". |
| Search-api path prompt sizes | **Measured exactly** by running the real prompt-builder code (`buildPlannerPrompt`, `buildPerigonAssemblyPrompt`, `buildPerigonUserMessage`) against a worst-case payload (12 articles, all snippets at the 400-char cap). Token counts use the chars/4 rule of thumb. |
| Search-api quality | Not measurable live here. Proxy evidence: the committed agentic samples (below) show what LLM-selected web results look like; Brave News/Tavily/Exa return the same class of sources with publisher-provided dates. Flagged as the main thing to verify with a live key. |
| Sample-output quality (`samples/newsletters/`, 6 issues) | **Inspected directly**: 61 unique cited URLs; 53/61 are deep article permalinks (the other 8 are deliberate resource links — live results pages, competition calendars). A 12-URL spot-check across all 6 issues returned **HTTP 200 for 12/12** (curl, Jul 21 2026). Recency and grading detail in `samples/newsletters/README.md`. |
| Cache coalescing | **Proven by test**: `scripts/check-news-cache.ts` (no keys needed) — two concurrent identical requests produce exactly one gather, in-process and cross-instance. |

## Published pricing used (all fetched Jul 21, 2026)

| Item | Price | Source |
|---|---|---|
| OpenAI `web_search` tool | $10.00 / 1k calls + content tokens at model rates | developers.openai.com/api/docs/pricing |
| gpt-5.4 | $2.50 in / $15.00 out per 1M tokens | same |
| gpt-5.4-mini | $0.75 / $4.50 | same |
| gpt-5.4-nano | $0.20 / $1.25 | same |
| claude-sonnet-5 | $2 / $10 (intro through Aug 31 2026; then $3 / $15) | platform.claude.com/docs pricing via search |
| Brave Search API (News endpoint) | $5 / 1k requests ($5 free monthly credit) | brave.com/search/api |
| Tavily | $0.008 / credit pay-as-you-go; 1k free credits/mo | tavily.com/pricing |
| Exa | $7 / 1k searches (≤10 results) + $1 / 1k pages per content type | exa.ai/pricing |
| NewsData.io | pricing page not retrievable from this environment — **not evaluated**; its variant is also key-less here | — |

## Re-verifying the baseline (why the agentic path costs what it costs)

The claimed Sonnet measurement (~422K gather input tokens for 3 topics) implies:
422K × $2/M ≈ $0.84 input + ~$0.09 web-search calls (3 topics × ~3 searches ×
$0.01) + output ≈ **$1.1–1.2** → consistent with the measured $1.167.

The claimed gpt-5.4-nano figure decomposes as: ~50K input × $0.20/M ≈ $0.01 +
~6 tool calls × $0.01 = $0.06 + output ≈ $0.005 → **≈ $0.075**, consistent with
the measured $0.077. Note what this means: **on a cheap model, ~80% of the cost
is the $10/1k tool fee itself** — the model can't get cheaper; only replacing the
tool can.

## Search-api path: measured prompt sizes → modeled cost

Exact sizes from the real prompt builders (worst case: 12 articles, 400-char snippets):

- Planner (gpt-5.4-nano): 150 tokens in, ~60 out → **$0.0001**
- Assembly (gpt-5.4-nano): 2,509 in, ~800 out → **$0.0015**
- Brave News: $0.005/query, 1–3 queries per topic (planner decides)

| Config | $/topic | $/3-topic briefing |
|---|---|---|
| nano + 1 Brave query | $0.0066 | $0.0198 |
| **nano + 2 Brave queries (expected typical)** | **$0.0116** | **$0.0348** |
| nano + 3 Brave queries (worst case) | $0.0166 | $0.0498 |
| mini + 2 Brave queries | $0.0159 | $0.0476 |

Tavily basic (≈1 credit = $0.008/query) and Exa ($0.007/query + contents) land
within ~1.5× of Brave; Brave is primary on price and because its News endpoint
returns publisher dates + extra snippets without a contents surcharge.

## Comparison table

Costs per 3-topic briefing, zero cache hits. "measured*" = prior live session
(not reproducible here); "modeled" = computed from measured prompt sizes +
published prices; latency figures are estimates from the redesign doc, not
measured here.

| Approach | $/briefing | Latency (est) | Quality evidence | Basis |
|---|---|---|---|---|
| Agentic tool, claude-sonnet-5 | $1.167 | 10–30s/topic | strong (tool does own multi-search) | measured* |
| Agentic tool, gpt-5.4 | $0.275 | 10–30s/topic | strong | measured* |
| Agentic tool, gpt-5.4-mini | $0.190 | 10–30s/topic | strong | measured* |
| Agentic tool, gpt-5.4-nano (current) | $0.077 | 10–30s/topic | samples graded 8.6–9.1/10; 12/12 URLs live | measured* |
| **search-api: Brave + nano (new)** | **$0.035** | ~5–12s/topic | not yet live-verified — same source class, snippet-grounded | modeled |
| search-api: Tavily + nano | ~$0.04 | ~5–12s/topic | not yet live-verified | modeled |
| search-api: Exa + nano | ~$0.045 | ~5–12s/topic | not yet live-verified | modeled |
| Perigon Plus tier (old default's real requirement) | $550/mo fixed (+$24k/yr for vector) | 5–15s | fails niche topics (see redesign doc) | published pricing |

## Decision

**Winner: `search-api` with Brave News + gpt-5.4-nano planning/assembly**, kept
behind the existing `NEWS_SOURCE` switch with `agentic` as the quality fallback.

Rationale, in order of weight:
1. **Cost**: 2.2× cheaper than the cheapest agentic config, 33× cheaper than the
   best-quality one, with the floor set by $0.005 searches instead of $0.01 tool
   calls + full-page context tokens.
2. **Cost control**: context size is bounded *in our code* (400-char snippets,
   12 articles) instead of by whatever pages the tool decides to ingest — cost
   can no longer blow up 8× by switching models (the 422K-token Sonnet run).
3. **Quality**: the assembler input is the same shape either way
   (`PreparedArticle[]` with title/source/date/snippet/url), and search-API
   results carry publisher dates, which the recency filter uses directly. The
   honest caveat: snippet-grounded gathering hasn't been live-graded like the
   agentic samples were — that's verification item #1 below.
4. **Reversibility**: one env var flips between `search-api`, `agentic`, and
   `perigon`. No downstream change.

## Caching design (cross-user)

`src/lib/news/cache.ts`, used by both the agentic and search-api fetchers:

1. **Canonical topic keys** — `canonicalTopicId()`: lowercase/slugify, strip
   filler words (news/latest/updates/daily/…), then a conservative alias map
   ("artificial intelligence" ≡ "AI news" ≡ "A.I." → `ai`; F1/Formula One →
   `formula_1`; …). Deterministic and free; an embedding-based matcher would
   catch more pairs but adds a model call per lookup — documented follow-up.
2. **Genuine coalescing** — before this change the topic cache had a 12s lock
   TTL and losers polled for max 6s, but a gather takes 10–30s: **the second
   concurrent request duplicated the gather almost every time** (and the
   agentic fetcher didn't take the lock at all). Now: lock TTL 90s (outlives
   the slowest gather), losers await the winner's published result for up to
   60s, and if the lock vanishes without a result (winner crashed) a waiter
   takes over the lock instead of stampeding. Two concurrent identical
   requests → one gather; proven in `scripts/check-news-cache.ts` for both the
   in-process and cross-instance paths.
3. **TTL: 6h for results, 30min for empty results.** The product is a daily
   briefing; the cron pre-generates each morning, so a 6h TTL bounds staleness
   within the product's own cadence while capping spend at ≤4 gathers/topic/day
   no matter how many users share the topic. Empty results expire in 30min so a
   quiet niche topic can revive without hammering the search API in between.
4. **Durability** — the cache and lock live in Upstash Redis (`KV_REST_API_*`),
   shared across all serverless instances; the in-process promise map is only a
   fast path within one instance. No-Redis dev environments degrade to
   in-process-only coalescing (fail-open).

## Projected cost at scale

Per topic-gather+assemble: agentic-nano $0.0257, search-api $0.0116 (2-query
typical). For N users × M topics/day, daily gather cost ≈
`N × M × (1 − hit_rate) × cost_per_topic`. Default topics (AI & Tech, World
News, Finance) are shared by most users, so canonical-key dedup drives hit-rate
up fast; 60% is a conservative assumption once >20 users share defaults.

| Scale | Cache hit-rate | Agentic-nano $/mo | Search-api $/mo |
|---|---|---|---|
| 10 users × 4 topics | 40% | $18.50 | $8.35 |
| 100 users × 4 topics | 60% | $123 | $56 |
| 1,000 users × 4 topics | 80% | $617 | $278 |

(Monthly = daily × 30. Zero-hit worst case is 2.5× the 60% row. TTS/email costs
unchanged and excluded.)

## Follow-ups

1. **Live verification with keys** (the big one): run the diagnostic harness's
   `brave-direct` / `tavily-direct` / `exa-direct` variants against the agentic
   baseline on the same 3 topics; grade link quality/recency like the committed
   samples were graded; confirm the modeled token counts.
2. Wire `search-api` into the diagnostic harness as a first-class variant
   (harness source is currently missing `types.ts` + 4 variant files; only the
   built `dist/index.cjs` is complete).
3. Consider Brave `freshness` per topic tier (pd for mainstream, pw/pm for
   niche) — currently fixed `pw`.
4. Embedding-based topic canonicalization if telemetry shows near-miss topic
   fragmentation.
5. NewsData.io evaluation if a key becomes available.
