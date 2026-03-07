# Dev Branch Changes (vs Master)

Summary of all changes in `origin/dev` that are not yet in `master`.

---

## 1. Remove Mobile Auth Infrastructure

Deletes the unified auth system that supported both web (NextAuth) and native iOS (Bearer token) sessions. All API routes now use `getServerSession()` from next-auth directly instead of `getAuthenticatedUser()`.

**Files removed:**
- `src/lib/auth-helper.ts` — unified auth helper (web + mobile)
- `src/lib/mobile-auth.ts` — Redis-backed mobile session management
- `src/app/api/auth/mobile-login/route.ts` — Google ID token verification + mobile session creation
- `src/app/api/auth/mobile-logout/route.ts` — mobile session revocation
- `src/app/api/subscription/verify-receipt/route.ts` — Apple App Store receipt verification

**Files modified (auth swap):**
- `src/app/api/generate/route.ts` — `getAuthenticatedUser()` → `getServerSession()`
- `src/app/api/schedules/route.ts` — same
- `src/app/api/stripe/create-checkout/route.ts` — same
- `src/app/api/stripe/create-portal/route.ts` — same
- `src/app/api/subscription/route.ts` — same

## 2. Revert Model to gpt-4o-mini (from gpt-5-nano)

`src/lib/models.ts` — removes `gpt-5-nano` as a model option. Default model changed back to `gpt-4o-mini`. Master currently uses `gpt-5-nano`.

## 3. Simplify Retry Logic

`src/app/api/generate/route.ts` — reduces `fetchWithRetry` from 5 retries with verbose logging to 3 retries with minimal logging. Removes 429 body logging, server error handling, and detailed retry warnings.

## 4. Remove Date Requirements from Cron Prompts

`src/app/api/cron/generate-briefs/route.ts` and `src/app/api/cron/send-briefs/route.ts` — removes the "today is" date prefix, date field requirements, and 7-day recency enforcement from the inline prompts. Also removes the `date` field from the JSON example.

## 5. Simplify Vercel Config

`vercel.json` — removes `functions` block that set `maxDuration: 60` for generate and cron routes. Only `"crons": []` remains.

## 6. Add Terms of Service + Support Pages

New pages:
- `src/app/terms/page.tsx` — full Terms of Service
- `src/app/support/page.tsx` — FAQ + contact info

## 7. Add Site-Wide Footer

`src/app/layout.tsx` — adds a footer with links to Privacy, Terms, and Support. Body gets `flex flex-col`, children wrapped in `<main className="flex-1">`.

## 8. Add SEO / OpenGraph Meta Tags

`src/app/layout.tsx` — adds OpenGraph, Twitter card, keywords, and robots metadata for better link sharing and search indexing.
