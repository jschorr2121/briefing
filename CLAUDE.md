# CLAUDE.md — Briefing

Personalized AI news briefings: pick topics → get a dated, sourced briefing per
topic on the web, by scheduled email, or as audio.

## Stack
Next.js 14 (App Router) · NextAuth (Google) · Upstash Redis · Brave News + Exa
for gathering · OpenAI gpt-5.4-nano for planning/assembly · OpenAI TTS · Gmail
SMTP · Stripe · Vercel. Native iOS app in `briefing-ios/` talks to the same API.

## Read first
- `docs/ARCHITECTURE.md` — the pipeline, every decision, and the measurements behind it (Oct 19, 2026).
- `CODEBASE.md` — where things live.

## Working rules
- One pipeline: `src/lib/briefing-pipeline.ts` → `gather.ts` → `briefing-assembler.ts`. Don't add a second gather path behind an env switch; add a provider inside `gather.ts`.
- Paid endpoints (`/api/generate`, `/api/audio`, `/api/email`) require a session. Keep it that way.
- Redis is optional: every cache/lock call fails open and the circuit breaker in `src/lib/news/cache.ts` keeps a dead Redis from slowing requests.
- Offline checks, no keys: `npx tsx scripts/check-gather.ts` and `npx tsx scripts/check-news-cache.ts`. Run both before committing pipeline changes.
- Live run: `npx next dev -p 3100`, `GET /api/test/auth-setup` for a dev session cookie (use the `__Secure-` cookie name when `NEXTAUTH_URL` is https), then `POST /api/generate`.

## Env vars
See README.md. Required for a working briefing: `OPENAI_API_KEY`, `BRAVE_API_KEY`
(+ `EXA_API_KEY` for niche topics), Google OAuth + `NEXTAUTH_*`. `CRON_SECRET`
is mandatory for the cron routes. Brave Free plan is 1 req/s: `BRAVE_MIN_INTERVAL_MS`
defaults to 1100; set 0 on a paid plan.

## Deploy
Push to `master` → Vercel. Crons are in `vercel.json` (generate 11:30 UTC, send 12:00 UTC).

## Log
- **Oct 19, 2026** — Rebuilt around one pipeline (Brave News + Exa fallback, gpt-5.4-nano). Deleted Perigon/agentic/legacy paths (~20k lines). Auth on paid endpoints, HTML-escaped email, cron fail-closed + no double sends, Stripe period-end fix, TTS voice list fixed, Redis circuit breaker. Live: 4-topic briefing 150s → 36s. Details in `docs/ARCHITECTURE.md`.
- **Jul 21, 2026** — Live A/B of search APIs vs LLM web search (superseded by the Oct rebuild).
- **Feb 4, 2026** — Hub removed, default topics, App Store prep.
