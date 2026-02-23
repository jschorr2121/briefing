# Dev Branch Changelog (Feb 3 – Feb 16, 2026)

## Summary

Major push toward App Store readiness: added Capacitor mobile scaffolding, removed unnecessary features (News Hub, health tips), improved free-tier UX, added legal/support pages, and improved SEO. Backend work includes mobile auth endpoints, retry logic hardening, and model migration to gpt-5-nano.

---

## Features

### Capacitor Mobile App Scaffolding (Feb 3)
- Added iOS and Android project scaffolding via Capacitor
- Native app icons, splash screens, and launch storyboards
- Capacitor config pointing to `briefing-five.vercel.app`
- Privacy policy page (`/privacy`) for App Store compliance
- Native bridge utilities (`src/lib/capacitor.ts`)

### Mobile Auth Endpoints (Feb 13)
- `POST /api/auth/mobile-login` — accepts Google ID token, returns `brf_*` session token
- `POST /api/auth/mobile-logout` — revokes mobile session
- Unified `auth-helper.ts` checks Bearer token first, then falls back to NextAuth session
- Mobile sessions stored in Upstash Redis with 30-day TTL

### Default Topics + localStorage Persistence (Feb 3)
- New users get pre-selected default topics (AI & Tech, World News, Finance)
- Topic selections persist across sessions via localStorage

### Terms of Service & Support Pages (Feb 4)
- Added `/terms` and `/support` routes
- Site-wide footer linking to Terms, Privacy, and Support

### OpenGraph & SEO Meta Tags (Feb 5)
- Added OpenGraph, Twitter Card, and SEO meta tags to `layout.tsx`
- Improves link previews when sharing on social platforms

---

## Removals

### News Hub (Feb 4)
- Removed Hub page, API route, and all related components (`HubFeed`, `StoryCard`, `TopicFilter`, `FeedSkeleton`)
- Removed taste profiling library (`taste-profile.ts`, `hub-types.ts`)
- Removed `NavigationTabs` component (orphaned after Hub removal)

### Health Tips from Emails (Feb 4)
- Removed health tip generation from scheduled briefing emails
- Product emails now focus purely on news content

### Default Pre-selected Topics (Feb 4)
- Removed auto-selection of default topics — users now start with a blank slate

---

## Bug Fixes

### Free Tier UI (Feb 4)
- Whitelisted users now correctly show free tier UI instead of pro
- Free briefings remaining counter always visible for free tier users

### Voice Picker Overflow (Feb 4)
- Fixed dropdown overflow on mobile devices

### Email Briefing Dates (Feb 4)
- Added publication dates to stories in scheduled briefing emails

### Retry Logic Hardening (Feb 16)
- Increased max retries from 3 to 5 with longer exponential backoff (2s, 4s, 8s, 16s, 30s cap)
- Logs 429 response body on every attempt for diagnostics
- Retries on 5xx server errors (previously only network errors and 429s)
- Set Vercel function timeout to 60s for generate and cron routes

---

## Infrastructure

### Model Migration (Feb 16)
- Default generation model switched from `gpt-4o-mini` to `gpt-5-nano`
- Updated model types, pricing, and fallback logic in `models.ts`

### Android Assets (Feb 4)
- Tracked android assets directory and Capacitor config files

### Documentation (Feb 3–4)
- Added `CLAUDE.md` dev log and App Store listing copy
- Added competitive landscape analysis (`docs/competitive-landscape.md`)
- Added `briefing.md` project context file

---

## Unmerged to Master

The following commits are on `dev` but not yet on `master`:

| Commit | Date | Description |
|--------|------|-------------|
| `a0391a5` | Feb 5 | OpenGraph, Twitter, and SEO meta tags |
| `1eada66` | Feb 4 | CLAUDE.md dev branch progress update |
| `5f77456` | Feb 4 | Terms of Service, Support pages + footer |
