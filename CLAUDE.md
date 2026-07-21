# CLAUDE.md — Briefing Development Log

## What Is Briefing
A personalized AI news briefing app. Users choose topics, generate briefings with real-time web search, listen via audio (12 OpenAI voices), get daily scheduled emails, and export as markdown.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, dark theme
- **Auth**: NextAuth.js with Google OAuth
- **AI**: OpenAI Responses API with web_search tool
- **Audio**: OpenAI TTS API (with chunking for long briefings)
- **Email**: Gmail SMTP (nodemailer) for scheduled briefings
- **Payments**: Stripe Checkout (subscription model)
- **Storage**: Upstash Redis (schedules, briefing cache, usage tracking)
- **Hosting**: Vercel
- **Mobile**: Capacitor (iOS + Android WebView shell)

## Current State (Feb 4, 2026)
- Web app is live and functional at briefing-five.vercel.app
- 3 users receiving daily scheduled briefings
- Capacitor mobile scaffolding complete (iOS + Android projects, native plugins)
- Stripe integration built but env vars not yet configured on Vercel
- News Hub feature removed (was unnecessary complexity)

## Recent Changes
- Removed News Hub (page, API, components, taste profiling)
- Removed health tips from scheduled emails (product emails should be pure news)
- Added default topics for new users (AI & Tech, World News, Finance)
- Added localStorage persistence for user topics
- Competitive landscape analysis in docs/

## Key Files
- `src/app/page.tsx` — Main briefing generation page
- `src/app/api/generate/route.ts` — Briefing generation API
- `src/app/api/cron/generate-briefs/route.ts` — Pre-generate briefings (runs before send)
- `src/app/api/cron/send-briefs/route.ts` — Send scheduled briefing emails
- `src/lib/query-planner.ts` — LLM query planner (routes topics to Perigon endpoints)
- `src/lib/briefing-generator.ts` — Perigon pipeline: query execution, cascade fallback, LLM assembly
- `src/lib/perigon.ts` — Perigon API client (articles, stories, vector, summarizer)
- `src/lib/alert.ts` — Email alerts for cron job failures
- `src/lib/capacitor.ts` — Native bridge utilities
- `capacitor.config.ts` — Mobile app config
- `MOBILE_SETUP.md` — Full guide for iOS/Android build + submission

## Perigon API Reference
Full Perigon API documentation is in `docs/perigon/`:
- `overview.md` — All endpoints, auth, pagination
- `articles.md` — `/v1/articles/all` params, query syntax, response schema
- `stories.md` — `/v1/stories/all` story clusters, when to use
- `vector-search.md` — `/v1/vector/news/all` semantic search
- `taxonomy.md` — Categories, topic tags, labels, source groups
- `summarizer.md` — `/v1/summarize` endpoint
- `entity-search.md` — Companies, journalists, companyName usage

Refer to these docs when modifying the query planner or Perigon API integration.

## Deployment
- Push to master → Vercel auto-deploys (or trigger: `curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_dDB96HruN79Qm1VQzc1aulyhz0Vz/vIAVZAlqNx"`)
- Mobile: `npm run mobile:ios` / `npm run mobile:android` (requires Mac for iOS)

## Next Steps → App Store Submission
See latest progress notes below.

---

## Progress Log

### Jul 21, 2026 (PM) — live-measured gather A/B
- Ran `scripts/live-ab-compare.ts`: agentic web_search tool vs direct search APIs, live, same 3 topics; evidence in `samples/live-ab/2026-07-21/`, analysis in `docs/COST_ANALYSIS.md` (revision 2, all numbers measured)
- Winner: hybrid — Brave News direct (2 short queries) + nano relevance gate + agentic fallback for sparse topics; $0.035/briefing vs $0.056–0.077 agentic-nano, 4–6× faster
- search-fetcher hardening from measured failures: short-query planner prompt, per-host cap, relevance gate (Brave returned FIFA articles for "speedcubing"), sequential queries + 429 retry (Brave ~1 QPS), NewsData query clamp, 60s timeout on agentic gather (saw a 194s hang)

### Jul 21, 2026
- **NEWS_SOURCE=search-api**: direct search-API gathering (Brave News primary, Tavily/Exa fallback) with gpt-5.4-nano query planning; snippet-only LLM context. ~$0.035/3-topic briefing vs $0.077 agentic-nano (analysis: `docs/COST_ANALYSIS.md`)
- **Cache coalescing fixed**: topic gathers now single-flight across serverless instances (90s lock, waiters await the winner's result); previously concurrent identical requests duplicated the gather
- **Canonical topic keys**: "AI news" ≡ "artificial intelligence" share one cache entry across users (`canonicalTopicId` in `src/lib/news/cache.ts`)
- Offline checks: `scripts/check-news-cache.ts`, `scripts/check-search-fetcher.ts`

### Feb 4, 2026
- Removed Hub, health tips from product emails
- Default topics + topic persistence shipped
- Preparing for App Store submission (see checklist in notes)
