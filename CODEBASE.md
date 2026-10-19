# Briefing — Codebase Map

Why things are the way they are: `docs/ARCHITECTURE.md`. This file is the where.

## Pipeline (`src/lib/`)

| File | Role |
|---|---|
| `briefing-pipeline.ts` | `generateBriefing(topics, settings)` — the only entry point. Section-cache check → gather → assemble. Returns one entry per topic; `empty: true` when no coverage. `generateBriefingsForCron()` wraps it for the crons. |
| `gather.ts` | Query planner (nano) → Brave News (rate-gated) → prepare/dedupe → relevance gate (nano) → Exa fallback when sparse → 6h single-flight cache. Exports the pure helpers that `scripts/check-gather.ts` tests. |
| `briefing-assembler.ts` | One JSON-mode chat call → `{summary, stories[]}`. Enforces story URLs ⊆ gathered URLs, drops stale/future dates, writes section cache + 72h "already covered" memory. |
| `prompts.ts` | Assembly prompts and the `PreparedArticle` shape. |
| `models.ts` | `BRIEFING_MODEL` / `SEARCH_PLANNER_MODEL` / `TTS_PROVIDER` readers with measured defaults. |
| `news/cache.ts` | Upstash client singleton, 1.5s op timeout, 60s circuit breaker, `fetchWithLock` cross-instance single-flight, `canonicalTopicId`. |
| `briefing-cache.ts` | Typed layers: section (6h) and schedule-day blobs (24h). |
| `filter-stories.ts` | Drops stories older than 2 months or future-dated. |
| `email.ts` | The one HTML email template (escaped) + `sendBriefingEmail` via Gmail SMTP. |
| `schedules.ts` | Redis CRUD for scheduled briefs, `shouldSendNow` (frequency + not-sent-today), `markScheduleSent`. |
| `subscription.ts` | Free/Pro tiers, daily usage counter, topic limit, admin allowlist. |
| `auth-helper.ts`, `mobile-auth.ts` | Session (web) or `brf_*` Bearer token (iOS) → user. |
| `stripe.ts`, `types.ts`, `utils.ts` | Stripe client, shared UI types, small helpers. |

## API routes (`src/app/api/`)

| Route | Auth | Notes |
|---|---|---|
| `POST generate` | session | usage limit, topic cap, → pipeline |
| `POST audio` | session | OpenAI/Google TTS; voice allowlist; 12k-char cap; maxDuration 60 |
| `POST email` | session | sends to the signed-in address only |
| `GET/POST/PUT/DELETE schedules` | session | validated fields, ≤3 schedules, ≤4 topics |
| `GET cron/generate-briefs`, `GET cron/send-briefs` | `CRON_SECRET` (503 if unset) | generate caches per UTC day (merge by email); send marks `lastSentAt`, keeps failed items for retry |
| `GET admin/schedules` | cron secret or admin email | |
| `GET subscription`, `POST subscription/verify-receipt` | session | receipt verification fails closed (501) until implemented |
| `stripe/*`, `POST webhooks/stripe` | Stripe sig | period end read from subscription items (2026 API) |
| `auth/[...nextauth]`, `auth/mobile-login`, `auth/mobile-logout` | — | |
| `GET test/auth-setup` | dev only | mints a session cookie for tests |

## Frontend (`src/app/`, `src/components/`)
`page.tsx` holds topics/settings/last briefing/history in localStorage (guarded, hydrated-before-save). `BriefingCard` renders stories or the empty-coverage notice. `schedule/page.tsx` creates daily schedules for the signed-in email. Voices: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer.

## Config
`vercel.json` — crons + maxDurations. `tsconfig.json` excludes `briefing-ios`, Capacitor dirs. `tests/` — Playwright specs (stale: they mock a `/api/topics` route that no longer exists).

## Scripts
`scripts/check-gather.ts`, `scripts/check-news-cache.ts`, `scripts/check-news-cache-live.ts` (needs Upstash).
