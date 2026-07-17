# Newsletter Pipeline Redesign — Agentic Gathering (July 17, 2026)

One deep session on the question: **should Briefing keep gathering news through a third-party news API (Perigon), or move to an LLM/agentic approach for gathering + writing?** Decision made with data below; implementation shipped behind the existing `NEWS_SOURCE` switch.

## TL;DR

**Verdict: agentic-first, Perigon optional.** `NEWS_SOURCE=agentic` (new, `src/lib/agentic-fetcher.ts`) gathers via one OpenAI web-search call per topic and feeds the *existing* assembly/cache/cron/email machinery. Perigon remains the default until the agentic path is verified with a live key; flipping one env var cuts over, flipping it back reverts.

- **Niche quality** (the product's core promise) is where the API loses outright: for "speedcubing" or "mechanical keyboards", the signal lives on community sites (WCA, speedcubing.org, kbd.news, geekhack, vendor group-buy pages) that a news-article index doesn't carry. Web search finds them; Perigon's niche cascade ends in vector search over news articles and returns loosely-related mainstream pieces.
- **Cost**: Perigon's pipeline as built (stories + vector endpoints) needs the Plus tier ($550/mo; vector search is Commercial-tier, $24k/yr list — verified from perigon.io/products/pricing, July 2026). The agentic path is ~$0.03–0.05 per topic-generation, pay-as-you-go (~$10/1k web-search calls + gpt-5-nano tokens). At today's 3 users this is a ~100× cost difference; break-even is roughly 100+ active users with zero topic overlap — and even there, Perigon still can't do niche.
- **Accuracy**: in prototyping, gather-then-verify caught real misinformation the API path would have passed through (details below).

## Where this fits (current state, mapped this session)

A briefing today: `/api/generate` or `cron/generate-briefs` → `briefing-pipeline.ts` (NEWS_SOURCE switch) → `briefing-generator.ts` → query-planner LLM → Perigon fetch cascade (`article-fetcher.ts`: top-100 5-day window → all-sources 7-day → vector) → LLM assembly (`briefing-assembler.ts`) → `{summary, stories[], articles[]}` → Redis section cache → frontend cards / email HTML.

Found and fixed on this branch (it didn't build):
- `briefing-generator.ts` imported `./briefing-assembler`, which was never committed on any branch — reconstructed from master's inline logic.
- `/api/generate` imported a nonexistent `checkUsage` — restored `checkAndIncrementUsage`.
- `scripts/diagnostic-compare/` (Jake's own A/B harness comparing Perigon vs Brave/Tavily/Exa/GPT-websearch — evidence this decision was already in motion) has missing variant sources and its own toolchain; excluded from the root tsconfig so `next build` passes.

Also present but **orphaned**: `src/lib/news/` — a complete, well-designed rebuild (shape-aware query planner, per-shape ranking with recency half-life, source diversification, single-flight Redis cache). Nothing imports it. Its gathering side is Perigon-only; its downstream (NewsCard/rank/cache) is source-agnostic. This session did **not** wire it in (that's a frontend-contract change); the agentic fetcher was instead built to the *active* pipeline's contract. When/if the `news/` cutover happens, `agentic-fetcher.ts` slots in as a second provider in `fetch-orchestrator.ts`.

## Research (key verified inputs)

Full sourcing captured during the session; the load-bearing facts:

- **Pricing** (all fetched July 2026): OpenAI Responses `web_search`: $10/1k calls + content tokens (developers.openai.com/api/docs/pricing). Anthropic web search: $10/1k searches. Perigon: Free 150 req/mo; Basic $250/mo (articles only, 1-hour delay); Plus $550/mo (adds stories, real-time); Commercial $24k+/yr (vector, summarizer). NewsAPI free tier is non-production; Bing News Search API retired Aug 2025.
- **Free feeds**: Google News RSS works and is fresh but its ToS restricts it to personal, non-commercial use — not a legal backbone for a paid product. Reddit's unauthenticated JSON died May 2026 (403s, datacenter-IP blocking — Vercel IPs included). HN Algolia API remains open and official. So "free RSS scraping" is not a viable primary path — which strengthens the LLM-web-search route.
- **Technique evidence**: Feedly dedupes 80% of 1.7M daily articles with cheap LSH before clustering; Meridian (best OSS analogue) does embed → UMAP → HDBSCAN → multi-stage LLM analysis and routes bulk work to the cheapest capable model ("the workhorse that makes it economically viable"); Anthropic's multi-agent research write-up: source-quality heuristics must be explicit in prompts or agents pick SEO farms over authoritative niche sources — directly incorporated into our gather prompt; citations should be validated post-hoc, not trusted from the writer (their CitationAgent pattern; our grounding-vs-url_citations check is the cheap version). Chain-of-Verification and entity-chain grounding measurably cut news-summary hallucination (arXiv 2309.11495, 2402.18873) — basis for the phase-2 verify pass.

## Prototype + grades

Five sample issues (mainstream → very niche) generated with the agentic method from real, current web material: `samples/newsletters/` (rubric + per-issue grades + head-to-head vs Perigon in its README). Overall grades 8.6–9.1/10; every URL real; every fact source-traceable.

What verification caught during prototyping — this is the strongest quality evidence:
1. A Google-News-surfaced claim that Ontario's Darlington SMR "began operation" was **false** (content-farm churn); primary sources confirm first power ~2029. An API pipeline has no step that could catch this.
2. A "Verstappen signs for McLaren" clickbait headline, corrected against formula1.com.
3. A leaked-not-confirmed Gemini launch date, excluded.
4. Search synthesis conflating 2023/2024 products as 2026 news in the keyboards niche, discarded.

## New architecture (`NEWS_SOURCE=agentic`)

```
topic ──► gather (1 Responses call, web_search tool)          agentic-fetcher.ts
              │  model runs 2–4 searches server-side,
              │  returns strict-JSON candidate articles
              ▼
         grounding filter: keep candidates whose URL/host
         appears in the call's url_citations (majority rule;
         falls back to citations themselves if JSON fails)
              ▼
         dedupe by URL · 45-day staleness cutoff · cap 12
              ▼
         6h Redis cache (websearch:articles:{topic})           news/cache.ts
              ▼
     LLM assembly → {summary, stories[], articles[]}           briefing-assembler.ts (unchanged)
              ▼
     section cache → frontend / cron email                     (unchanged)
```

Design choices, deliberately:
- **2 LLM calls per topic, total.** The agentic path skips the separate query-planner call — the search model does its own query expansion (validated in prototyping). Perigon path is unchanged.
- **Fabricated-URL defense in code, not prompt**: candidates are cross-checked against the API's own `url_citation` annotations. A URL the model never actually saw doesn't ship.
- **Same output contract** (`ArticleSet` → `PreparedArticle[]`): assembly, section cache, cron pre-generation, email HTML, frontend — all untouched. The diff is one new file + a source branch + three one-line dispatcher updates.
- **Shared-cost caching**: gathered articles cached 6h per topic, so overlapping users (and generate-after-cron hits) don't re-search.
- **Graceful failure**: JSON-parse failure falls back to raw citations; grounding failure falls back to valid candidates with a warning; empty gather → topic skipped (existing behavior).

### Cost & latency (estimates — verify with a live key)

Per topic-generation: gather ≈ $0.02–0.04 (2–4 searches) + ~$0.003 tokens (gpt-5-nano) + assembly ≈ $0.002 → **~$0.03–0.05**. A 4-topic daily user ≈ $0.12–0.20/day *worst case, zero cache hits*; shared topics amortize across users. Latency: gather 10–30s + assembly 3–8s — slower than Perigon (~5–15s) but irrelevant for the cron path (pre-generated) and acceptable on-demand; mitigated by the 6h cache.

### Runnable check

`npx tsx scripts/check-agentic-fetcher.ts` — offline tests of the JSON parsing and grounding/fallback logic (no network/keys).

## What's left / needs a key to verify

1. **End-to-end live run** (`OPENAI_API_KEY`): set `NEWS_SOURCE=agentic` in dev, generate for the 5 sample topics, confirm: gpt-5-nano supports the `web_search` tool on the Responses API (the legacy path assumed it; if not, set `BRIEFING_MODEL=gpt-4o-mini` or add a search-capable model to `models.ts`), annotations arrive, grounding keeps ≥ 6 candidates on mainstream topics, real token/search counts vs the estimates above.
2. **Redis cache path** (`KV_REST_API_*`): confirm `websearch:articles:*` writes and 6h expiry.
3. **Cron rehearsal**: run `cron/generate-briefs` with `NEWS_SOURCE=agentic` against a test schedule before flipping prod; email rendering is unchanged but eyeball one.
4. **Tune** `MAX_AGE_DAYS` (45) and the grounding majority threshold against live behavior.

## Shipped in this session beyond the core switch

- **Per-topic source memory** (`agentic-fetcher.ts`): hosts that produced grounded coverage are remembered (`websearch:sources:{id}`, 30d TTL, cap 10) and injected as hints into the next gather — so the second "speedcubing" generation starts from speedcubing.org + WCA instead of rediscovering them. Only grounded results update memory, keeping junk hosts out.
- **Issue-over-issue freshness** (`briefing-assembler.ts`, so it benefits *both* paths): the URLs a topic covered recently (`briefing:seen:{id}`, 72h TTL, cap 30) are passed to assembly, which is told to lead with what's new and repeat a story only on a significant development. Soft signal — sparse niche topics still get an issue.

## Phase 2 (highest-leverage next steps, in order)

1. **Verify pass for facts, not just URLs**: fetch the top 3–5 candidate pages (plain HTTP), pass excerpts to assembly, and entity-check the draft (names/numbers/dates must appear in a cited source). This is what caught the Darlington fake in prototyping. Cost: ~1 extra small LLM call + free fetches. *(The samples were generated with this step; the production fetcher grounds on citations only, so this is the main remaining quality gap.)*
2. **`news/` cutover**: wire Jake's orphaned rebuild in as the engine (its rank/diversify/cache is better than the active path's), with `agentic-fetcher` as a provider alongside `perigon-client`.
3. **Embedding dedup**: source-memory and seen-tracking are URL/host based; add embedding similarity so the same event from a different URL is also caught (Feedly-style LSH prefilter).
