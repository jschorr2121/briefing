# Gather Cost Analysis — Search APIs vs LLM Web-Search Tools

Decision record for `NEWS_SOURCE=search-api` (`src/lib/search-fetcher.ts`) and the
cross-user cache improvements in `src/lib/news/cache.ts`.

**Revision 2 (Jul 21, 2026, PM):** the first revision of this doc was written in
an environment with no API keys and modeled the search-api costs from prompt
sizes. Keys became available; everything below is now backed by a **live A/B
run** of the real production code paths (`scripts/live-ab-compare.ts`) over the
same 3 default topics (AI & Tech, World News, Finance), with exact token usage
from API `usage` fields, wall-clock latency, and inspection of every gathered
article (URLs HTTP-checked, dates/titles/sources reviewed). Where a number
could *not* be produced live it is explicitly marked.

## TL;DR

**Winner: a hybrid — Brave News called directly (2 short planner queries/topic)
with gpt-5.4-nano for planning + relevance-gate + assembly, falling back to the
agentic web-search gather only when a topic comes back sparse or off-topic.
Measured $0.035 per 3-topic briefing vs $0.056–0.077 for the agentic path on
nano — ~40–55% cheaper — and 1.6–3.6s per topic vs 7–21s, a 4–6× latency win.**

Two things real measurement changed vs the modeled revision:
1. The naive "search APIs are 10× cheaper" hypothesis is **false at list
   prices**: search fees ($5–7/1k) replace the web_search tool fee ($10/1k) at
   a similar order of magnitude. The real wins are the ~60× smaller LLM input
   (150 planner tokens vs 9–15K web-tool context), latency, and *cost
   control* — queries per topic is now a dial we own.
2. Quality is **not** a monotonic agentic win: agentic-nano produced the single
   worst editorial result of the whole A/B (see below), while raw Brave produced
   the single worst relevance result. Both failure modes are cheap to fix; the
   hybrid fixes both.

## What was measured live (Jul 21, 2026) and what wasn't

| Evidence | Status |
|---|---|
| Agentic gather (OpenAI Responses `web_search` tool), gpt-5.4-nano and gpt-5.4-mini | **Measured live**, 3 topics each: exact tokens, tool-call counts, latency, all articles inspected, URLs HTTP-checked |
| search-api gather via Brave News and Exa | **Measured live**, 3 topics each (Brave twice: pre- and post-tuning), same instrumentation |
| search-api via NewsData.io | **Measured live — failed**: rejects >100-char queries (HTTP 422; now clamped), found articles for 1 of 3 topics, and its "World News" results were school-assembly listicles. Kept only as last-resort fallback |
| search-api via Tavily | **Not runnable**: the `TAVILY_API_KEY` in this environment is invalid (HTTP 401 on every call). No Tavily numbers are claimed |
| Agentic path on claude-sonnet-5 / gpt-5.4 | Not re-run (no Anthropic key here; gpt-5.4 not re-tested to limit spend). Last week's live measurements retained, marked `measured*` |
| Niche-topic behavior | **Measured live** on "speedcubing" and "artisanal fountain pen restoration" — this run caught the Brave relevance failure and exercised the new gate + fallback |
| Cache coalescing logic | **Proven by committed tests** (`scripts/check-news-cache.ts`, fake Redis, no keys needed): 15 checks incl. one-gather-for-two-concurrent-requests, cross-instance, crash takeover |
| Cache coalescing against live Upstash | **Not runnable here**: the Upstash host is unreachable from this sandbox (DNS blocked even via proxy). `scripts/check-news-cache-live.ts` is committed to run the same proof against real Redis from any environment that can reach it |

Raw A/B outputs (tokens, latency, per-call log, every article, assembled
briefings) were captured by `scripts/live-ab-compare.ts`. The runner
deliberately blanks the Redis env vars so measurement never reads or writes the
production cache.

## Published pricing used (all fetched Jul 21, 2026)

| Item | Price | Source |
|---|---|---|
| OpenAI `web_search` tool | $10.00 / 1k calls + content tokens at model rates | developers.openai.com/api/docs/pricing |
| gpt-5.4-mini | $0.75 in / $4.50 out per 1M tokens | same |
| gpt-5.4-nano | $0.20 / $1.25 | same |
| Brave Search API (News endpoint) | $5 / 1k requests; $5 free credit/mo | brave.com/search/api |
| Exa | $7 / 1k searches (≤10 results) + $1 / 1k pages per content type (highlights) | exa.ai/pricing |
| claude-sonnet-5 | $2 / $10 (intro through Aug 31 2026) | platform.claude.com (fetched last week) |

## Measured comparison (per 3-topic briefing, zero cache hits)

Token counts are sums over the 3 topics from API `usage` fields; assembly ran
with identical prompts (gpt-5.4-nano) for every approach, so the comparison is
apples-to-apples. Latency is per-topic gather wall-clock.

| Approach | Gather tokens (in/out) | Search/tool calls | $/briefing | Latency/topic | Articles |
|---|---|---|---|---|---|
| Agentic tool, gpt-5.4-nano | 31,347 / 4,101 | 4 web_search tool calls | **$0.056** | 11.8–13.4s | 26 |
| Agentic tool, gpt-5.4-mini | 33,766 / 3,116 | 5 tool calls | **$0.093** | 6.8–21.2s | 21 |
| search-api Brave, 3 long queries (pre-tuning) | 435 / 145 | 9 Brave requests | **$0.050** | 1.6–3.6s | 32 |
| **search-api Brave, tuned (2 short queries + relevance gate)** | ~950 / ~100 | 6 Brave requests | **$0.035** | 1.6–1.9s | 30 |
| search-api Exa (3 queries + highlights) | 435 / 154 | 9 searches + 90 content pages | **$0.158** | 2.9s (18s cold) | 36 |
| search-api NewsData | 435 / 157 | 9 requests | n/a | 1.7–2.1s | 8 (1 of 3 topics) |
| Agentic tool, claude-sonnet-5 | ~422K input | — | $1.167 | 10–30s | — (measured* last week) |
| Agentic tool, gpt-5.4 | — | — | $0.275 | — | (measured* last week) |

Cost decomposition of the two leading options:

- **Agentic-nano $0.056** = input $0.0063 + output $0.0051 + **tool fee $0.040**
  + assembly $0.0043. The $10/1k tool fee is 71% of the total — a cheaper model
  cannot reduce it, only replacing the tool can. (Last week's identical config
  measured $0.077 — the tool decides how many searches to run per topic, 1–3
  observed, so day-to-day variance is ±30%.)
- **Brave tuned $0.035** = Brave fees $0.030 + all LLM calls combined $0.005.
  Search fees are now 86% of the cost, and they're a dial we control:
  queries/topic × $0.005. The planner is prompted for 1–2 short queries
  (3 max), and the whole LLM side rides on ~150-token prompts.
- **Exa $0.158** = the surprise: $7/1k searches + $1/1k highlight pages makes
  Exa **more expensive than the agentic path**. Its quality was the best of the
  direct APIs (see below) — documented here as the quality-premium option, not
  the default.

## Quality (from inspecting the actual gathered articles)

Every URL from every run was HTTP-checked: **zero 404s / zero fabricated URLs
in any approach** (all non-200s were 403/503 bot-blocking by paywalled sites —
Bloomberg, Reuters, NYT — i.e. real links a human can open). All approaches
returned overwhelmingly ≤7-day-old articles. The differences were editorial:

- **Agentic-nano failed World News**: it returned exclusively UN-agency
  situation reports (OCHA/UNRWA/DPPA) and **entirely missed the Iran–US war
  escalation** that led every other approach's output and the actual news cycle
  that day. Institutional-source bias, weak editorial judgment at nano scale.
- **Agentic-mini** had the best editorial judgment overall (Reuters/AP leads,
  correct top story on all 3 topics) — at 2.7× the cost and the worst latency.
- **Brave pre-tuning failed Finance**: 3 long essay-style planner queries
  ("global central banks monetary policy decisions 2026 IMF World Bank…")
  pulled SEO/fringe blogs (lewrockwell.com, countercurrents.org, quasa.io) and
  the junk *survived assembly* — the final briefing led with an SEO blog.
  **Post-tuning** (short entity-anchored queries: the planner prompt now
  demands 2–6-word news-editor phrasing) the same topic returned Bloomberg,
  Fortune, Investopedia, federalreserve.gov, and the assembled briefing was
  clean. This one prompt change was the single highest-leverage quality fix in
  the A/B.
- **Brave failed "speedcubing" catastrophically**: 10 confident results about
  the **FIFA World Cup** (keyword matching). This motivated the two new
  guards: a **relevance gate** (one ~350-token nano call over titles, ≈$0.0001,
  which live-kept exactly the 2 genuinely-speedcubing articles) and the
  **agentic fallback** when fewer than 4 articles survive. Both fired correctly
  live. (The fallback's agentic call itself hit OpenAI `web_search` throttling
  during the test and degraded gracefully to the gated search results — the
  429/timeout path is now bounded by a 60s `AbortSignal` instead of the 194s
  hang observed.)
- **Exa** was the strongest direct API: freshest set (everything Jul 15–21),
  strong sources (Al Jazeera live coverage, JPMorgan, SF Fed, EU Commission).
  One flaw — 5 of 12 World News articles from one host — which motivated the
  new per-host cap (max 3), applied to all providers.
- **NewsData** returned off-topic listicles and covered 1 of 3 topics —
  eliminated as primary on quality alone, before price enters the picture.

## Decision

**`NEWS_SOURCE=search-api` with Brave News primary + agentic fallback (hybrid),
all knobs set by the measured data:**

1. Planner (gpt-5.4-nano): 1–2 short entity-anchored queries (quality: fixes
   the SEO-junk failure; cost: each query is $0.005).
2. Sequential query execution with one retry after 1.1s on HTTP 429 (Brave
   enforces ~1 QPS; the live run lost a query to 429 when run in parallel).
3. `prepareSearchResults`: permalink check, 45-day staleness cutoff, URL+title
   dedupe, **max 3 articles/host**, 400-char snippet cap, ≤12 articles.
4. **Relevance gate**: one nano call over titles drops keyword-collision junk
   (fail-open on any error).
5. **Agentic fallback** when <4 relevant articles survive — niche topics get
   the strength of the web-search tool (community sites a news index doesn't
   carry), and its cost is confined to exactly the topics that need it.
   `SEARCH_API_AGENTIC_FALLBACK=0` opts out.
6. Provider order: Brave → Tavily → Exa → NewsData (auto by available key,
   `SEARCH_API_PROVIDER` forces). Exa is quality-strong but priced out as
   default ($0.158/briefing measured config); NewsData is last-resort.

Reversibility unchanged: one env var flips `search-api` / `agentic` / `perigon`.

## Caching design (cross-user)

`src/lib/news/cache.ts`, used by both the agentic and search-api fetchers:

1. **Canonical topic keys** — `canonicalTopicId()`: lowercase/slugify, strip
   filler words (news/latest/updates/…), then a conservative alias map
   ("artificial intelligence" ≡ "AI news" ≡ "A.I." → `ai`). Deterministic and
   free; embedding-based matching remains a follow-up if telemetry shows
   fragmentation.
2. **Genuine coalescing** — the pre-existing lock had a 12s TTL and losers
   waited max 6s, but a gather takes 2–30s: concurrent identical requests
   duplicated the gather. Now: 90s lock TTL, losers await the winner's
   published result up to 60s, and take over the lock if the winner crashes.
   Two concurrent identical requests → **one** gather. Proven by
   `scripts/check-news-cache.ts` (in-process + cross-instance + crash-takeover,
   15 checks, fake Redis); `scripts/check-news-cache-live.ts` runs the same
   core proof against real Upstash (not reachable from this sandbox — run it
   from a machine with Upstash access).
3. **TTL: 6h results / 30min empty results** — bounds staleness within the
   product's daily cadence while capping spend at ≤4 gathers/topic/day
   regardless of user count; quiet niche topics can revive within 30min.
4. **Durability** — cache + lock live in Upstash Redis (`KV_REST_API_*`),
   shared across serverless instances; the in-process promise map is only a
   fast path. No Redis → graceful fail-open.

Caching multiplies through *either* gather path, but it interacts with pricing:
at the current scale (3 users sharing the default topics ≈ 3–5 canonical
topics), tuned-Brave usage is ~40 requests/day ≈ 1,200/mo — barely above
Brave's $5 free monthly credit (1,000 requests), i.e. **near-zero search spend
at today's scale**.

## Projected cost at scale (measured per-topic numbers)

Per fresh topic-gather+assemble: agentic-nano $0.0186, tuned Brave $0.0116.
Daily gather cost ≈ `unique_canonical_topics × (24h / 6h TTL) × cost_per_topic`
— user count stops mattering once topics overlap, which is the point of
canonical keys + coalescing.

| Scale | Cache hit-rate | Agentic-nano $/mo | search-api hybrid $/mo |
|---|---|---|---|
| 10 users × 4 topics | 40% | $13.40 | $8.35 |
| 100 users × 4 topics | 60% | $89 | $56 |
| 1,000 users × 4 topics | 80% | $446 | $278 |

(Monthly = daily × 30; assumes ~10% of gathers trigger the agentic fallback,
included in the hybrid column. TTS/email costs unchanged and excluded.)

## Follow-ups

1. Valid Tavily key → run the same A/B for Tavily (only provider never
   live-measured).
2. Run `scripts/check-news-cache-live.ts` from an environment that can reach
   Upstash (laptop / Vercel job) for the live coalescing proof.
3. Brave `freshness` per topic tier (pd for mainstream, pw/pm for niche) —
   currently fixed `pw`.
4. Embedding-based topic canonicalization if telemetry shows near-miss
   fragmentation.
5. Wire `search-api` into the diagnostic harness as a first-class variant
   (harness source still missing `types.ts` + 4 variant files).
6. Watch the relevance gate's false-drop rate on real user topics (it's
   prompted to keep-when-unsure and fails open).
