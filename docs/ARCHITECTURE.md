# Briefing — Architecture & Decision Record (Oct 19, 2026)

One pipeline, one switchboard of env vars, nothing speculative. This file explains
*why* the code looks the way it does; `CODEBASE.md` says *where* things are.

## The pipeline

```
topic name ──► gather (src/lib/gather.ts)
                 1. plan 1–2 short queries           gpt-5.4-nano, ~200 tokens
                 2. Brave News (freshness=pw)         1 req/s gate on the Free plan
                 3. prepare: validate, dedupe, 45-day cutoff, ≤3/host, no Wikipedia
                 4. relevance gate over titles        gpt-5.4-nano, ~300 tokens
                 5. if < 5 survive → Exa (category=news, 14-day window), same prep+gate
                 6. cache 6h per canonical topic, single-flight across instances
                 7. fetch article body text for kept articles (8s hard budget, fail-soft)
            ──► assemble (src/lib/briefing-assembler.ts)
                 one chat call, JSON mode, gpt-5.6-luna by default
                 stories may only link URLs we supplied; dates come from the article
                 bullet guard strips "X reported that…" and date-only bullets
                 verify pass (nano): drops contradicted headlines/bullets + duplicate events
                 story floor: one retry if the writer returned < 2 stories
                 72h "already covered" memory so tomorrow leads with new stories
                 section cache 6h
            ──► cross-topic dedupe (never below 2 stories per topic)
            ──► { topic, summary, stories[], articles[] }  →  web UI / email / TTS
```

`/api/generate` and the two cron routes all call `generateBriefing()` in
`src/lib/briefing-pipeline.ts`. There is no other path.

## Decisions, with the measurements behind them

### Gathering: Brave News primary, Exa fallback — not Perigon, not LLM web search

Live comparison on Oct 19, 2026 (same queries, 4 topics):

| Source | Mainstream ("AI & Tech", SMRs) | Niche ("speedcubing", "mechanical keyboards") | Price |
|---|---|---|---|
| Brave News | AP, CNBC, Guardian, World Nuclear News; all dated | 3 results, 1 junk | $5/1k; Free plan: 2k/mo, 1 req/s |
| Brave Web | Wikipedia ×7 | shop/coupon pages | same plan |
| Exa `category=news` | fine, some hub pages | speedcubersdigest, speedsolving.com, UKCA, WCA — plus Finnish/Korean classifieds | $7/1k |
| Exa no category | site section pages | vendor group-buy pages | $7/1k |
| OpenAI `web_search` (Jul data + today) | good | good | $10/1k + 10–30k context tokens; 7–21s; hung to the 60s timeout today |
| Perigon | good | weak (news index only) | $250–550/mo minimum for commercial use |

So: Brave for everything, Exa only when Brave is thin, a nano relevance gate
after each (it is what removes the Finnish classifieds and the FIFA-for-
speedcubing matches), and the LLM web-search tool is gone entirely.

Cost per fresh topic ≈ $0.010–0.014 search + ~$0.006 LLM (planner, gate,
writer with article text, verifier). A 4-topic briefing with no cache hits ≈
$0.07, 30–40s wall-clock; with the 6h topic cache and shared topics across
users it is far less. At today's scale Brave's 2,000 free requests/month cover
everything.

### Persona evaluation loop (Oct 19, 2026)

`scripts/eval-briefing.ts` runs the real pipeline for five user personas (20
topics) without touching the shared cache. Five reviewer agents, each playing
one persona, read the output, fact-checked it against the web, and graded it;
seven rounds of changes followed. What the loop found and fixed, in order of
impact:

| Round-1 defect (all five personas) | Fix |
|---|---|
| Week-old stories stamped with today's date | Brave `page_age` + URL-path dates, never relative `age` |
| "source reminder:" / "date:" bullets, "NYT:" prefixes, "The article reports…" | Prompt rewrite + regex guard; writer switched to gpt-5.6-luna (meta-narration bullets 122 → 4 on the same 20 topics) |
| Press releases, content farms, betting picks, listicles, reviews | Host blocklist + relevance-gate categories + English-text check |
| Same event under two topics / two cards for one event | Cross-topic dedupe (2-story floor) + verifier duplicate check |
| Bullets that restated the headline because the writer only saw a snippet | Article body text fetched for kept articles |
| A fabricated race result | Verifier pass against the fetched text |
| Topics collapsing to 0–1 stories after filtering | Dedupe floor + assembly retry |
| "Sources" list advertising rejected junk | Sources = cited articles only |

Persona grades r1 → r7 (1–10): Fed 4→7, Crypto 5→8, OpenAI 4→8, Boston 5→8,
Protein 5→8, Climate 6→7. Weak spots that remain: F1/NBA when the last race or
game is outside Brave's 7-day window; "Machine Learning Research" and
"Mechanical Keyboards", where the news breaks on arXiv/geekhack-type sites that
neither index carries well.

### Assembly model: gpt-5.6-luna

Same prompt, same 10 articles, Oct 19, 2026:

| Model | Latency | Cost/topic | Notes |
|---|---|---|---|
| gpt-5-nano (old default) | 51–76s | $0.002–0.003 | reasons into 4–8k output tokens; picked classified ads |
| **gpt-5.4-nano** | 5–7s | $0.0015 | skipped junk hosts, clean JSON |
| gpt-5.6-luna | 12–14s | $0.0017 | same picks, slightly nicer headlines |
| claude-sonnet-5.5 | 13s | $0.025 | best prose and proper source names; 16× the cost |

The persona loop then showed gpt-5.4-nano ignores "no meta-narration" rules
that gpt-5.6-luna follows at the same price, so Luna is the writer; nano
still runs the planner, gate and verifier. `BRIEFING_MODEL` overrides.

### Redis is optional and must never be slow

The Upstash host in `.env.local` no longer resolves. Before today every cache
op waited 3s to time out, so one briefing took 150s. `src/lib/news/cache.ts`
now has a 1.5s op timeout and a 60s circuit breaker: the first failure pauses
Redis use, everything else fails open. Without Redis the app still generates
briefings; it just can't cache, schedule, or count usage.

### Security posture (all paid endpoints)

`/api/generate`, `/api/audio`, `/api/email` require a session. Email goes only
to the signed-in address and every interpolated string is HTML-escaped. Cron
routes refuse to run without `CRON_SECRET`. `/api/admin/schedules` needs the
cron secret or an admin email. App Store receipt verification fails closed
until it is actually implemented. Per-user daily briefing limits remain the
only throttle; a Redis-backed rate limiter on `/api/audio` and `/api/email` is
the next step once Redis is back.

## What was removed (git history has it all)

Three parallel gather pipelines (Perigon with curated topic engine + query
planner, agentic OpenAI web-search, search-api), the legacy single-call
OpenAI/Perplexity paths, the orphaned `src/lib/news/*` rebuild (its cache
module survived), the duplicated legacy code inside both cron routes, two email
templates, `/api/topics*`, `/api/cron/test`, the diagnostic harness, A/B sample
dumps, TTS sample MP3s, and ~20k lines of stale docs. 

## Toward the feed

The gather layer already produces what a feed needs: dated, deduped, relevance-
gated articles per canonical topic, cached in Redis. A feed is "show the cached
article sets for the user's topics, newest first" plus a per-user read-state —
no new provider work. Do not build it until someone asks for it.
