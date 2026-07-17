# Sample Newsletters — Agentic Pipeline Prototype (July 17, 2026)

Five sample issues generated with the proposed **agentic gather → rank → grounded write** method, spanning mainstream → very niche. Every issue was built from real, current web material gathered at generation time; every URL was received from an actual search/fetch, never constructed.

These emulate the target pipeline (`NEWS_SOURCE=agentic`, see `docs/newsletter-pipeline-redesign.md`). The emulation is *more* thorough than the day-1 production pipeline (it fetched full article pages to verify facts — production v1 grounds on search results and citations; the verify pass is the documented phase-2 upgrade).

| Topic | Tier | File |
|---|---|---|
| AI & Tech | mainstream (default topic) | [ai-and-tech.md](ai-and-tech.md) |
| Formula 1 | mainstream / enthusiast | [formula-1.md](formula-1.md) |
| Small modular reactors | industry niche | [small-modular-reactors.md](small-modular-reactors.md) |
| Mechanical keyboards | hobby niche | [mechanical-keyboards.md](mechanical-keyboards.md) |
| Speedcubing | very niche | [speedcubing.md](speedcubing.md) |

## Rubric

Each issue graded 1–10 on: **Relevance** (on-topic stories), **Accuracy/Sourcing** (every fact traceable to a real source; no fabricated URLs), **Freshness** (recency appropriate to the topic's publishing cadence), **Writing** (tight, concrete, newsletter-quality prose), **Personalization** (does it read like it was made for a follower of this exact topic — right sources, right depth), **Signal/Noise** (distinct stories, no listicles/reprints/filler), **Efficiency** (tool calls needed; production target is 1 web-search LLM call + 1 assembly call per topic).

## Grades (honest, self-assessed)

| Topic | Relev. | Accur. | Fresh. | Writing | Personal. | Signal | Effic. | Overall |
|---|---|---|---|---|---|---|---|---|
| AI & Tech | 10 | 9 | 9 | 9 | 8 | 9 | 7 (18 calls) | **8.7** |
| Formula 1 | 10 | 9.5 | 10 | 9 | 9 | 9 | 7 (15 calls) | **9.1** |
| Small modular reactors | 10 | 10 | 9 | 9 | 9 | 9 | 6 (21 calls) | **8.9** |
| Mechanical keyboards | 10 | 8.5 | 9 | 9 | 10 | 9 | 5 (26 calls) | **8.6** |
| Speedcubing | 10 | 8.5 | 9 | 9 | 9 | 9 | 9 (5 calls) | **9.1** |

Grading notes (the deductions, so they're not hidden):
- **Accuracy**: mechanical-keyboards' switch-chart story relies on search snippets (kbd.news 403-blocks fetches); speedcubing's WCA-event-change story is single-sourced to speedcubing.org. One inference bullet ("records expected frozen") was caught in review and removed. Everything else was fetch-verified.
- **Efficiency**: the emulation agents over-searched relative to the production design (one Responses-API call runs its 2–4 searches server-side). Niche topics inherently cost more calls than mainstream — that's the right place to spend.
- **Freshness**: niche topics carry some 2–4-week-old stories by design — that matches the niche's own publishing cadence (a good older story beats no story).

## What the verification step caught (why gather-only isn't enough)

- **SMR**: the seed lead from Google News ("Darlington SMR began operation") was content-farm misinformation — primary sources confirm construction is ongoing, first power targeted 2029. The issue reports the true status and flags the mischaracterization.
- **Formula 1**: a GPFans headline claimed Verstappen "signs for McLaren"; cross-checking against formula1.com/PlanetF1 showed talks that "didn't go anywhere." A secondary source's "rear wing failure" claim contradicted the official race report and was dropped.
- **AI & Tech**: a leaked "Gemini 3.5 Pro GA on July 17" date was excluded as an unconfirmed rumor.
- **Mechanical keyboards**: search synthesis conflated similarly-named products across years (a 2023 Cherry board and a 2024 GMK set presented as 2026 news) — both discarded on verification.

## Head-to-head: what the current Perigon pipeline would plausibly produce

Judged against the pipeline in `src/lib/article-fetcher.ts` (top-100 source group, 5-day window, cascade to all-sources/vector):

- **AI & Tech / Formula 1**: Perigon would produce a decent issue — this is its sweet spot. But it has no defense against reprint/aggregator noise beyond label filters, and no fact verification. Roughly comparable relevance; weaker sourcing discipline.
- **Small modular reactors**: partial. Reuters-tier SMR coverage exists in Perigon's index, but the trade press carrying the real detail (World Nuclear News, NEI) is outside the top-100 source group — the cascade would need to fall through to all-sources and would rank them below wire-service reprints.
- **Mechanical keyboards / Speedcubing**: fails the vision. The signal lives on speedcubing.org, WCA, kbd.news, geekhack, vendor group-buy pages — community sources a news-article index doesn't carry. Perigon's niche cascade ends in vector search over news articles, which returns loosely-related mainstream pieces (a Rubik's-cube human-interest story, a "best keyboards" listicle). No version of the current pipeline produces the group-buy-closes-today issue.

**Verdict: agentic wins.** Decisively on niche (the product's stated differentiator), ties-or-wins on mainstream, catches misinformation the API pipeline would pass through, and costs ~$0.03–0.06/topic-day marginal instead of a $550+/mo fixed Perigon tier (vector search — which the niche cascade depends on — requires Perigon's Commercial tier, $24k/yr list). Full evidence and architecture in `docs/newsletter-pipeline-redesign.md`.
