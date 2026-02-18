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

## Current State (Feb 16, 2026)
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
- `src/lib/capacitor.ts` — Native bridge utilities
- `capacitor.config.ts` — Mobile app config
- `MOBILE_SETUP.md` — Full guide for iOS/Android build + submission

## Deployment
- Push to master → Vercel auto-deploys (or trigger: `curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_dDB96HruN79Qm1VQzc1aulyhz0Vz/vIAVZAlqNx"`)
- Mobile: `npm run mobile:ios` / `npm run mobile:android` (requires Mac for iOS)

## Next Steps → App Store Submission
See latest progress notes below.

---

## Progress Log

### Feb 17, 2026
- **[dev branch]** Added robots.txt and sitemap.xml for SEO
  - robots.txt: allows crawling, blocks API/login routes
  - sitemap.xml: all public pages with priorities
- **[dev branch]** Added Google Play Store listing copy draft (`docs/google-play-listing.md`)
  - Full description with Google Play-friendly formatting (emoji headers, visual breaks)
  - Data safety declaration template
  - Feature graphic and screenshot requirements
  - Submission checklist and review tips

### Feb 16, 2026
- **[dev branch]** Added App Store listing copy draft (`docs/app-store-listing.md`)
  - Name, subtitle, full description, keywords, categories
  - Screenshots checklist and tips
  - Ready for Jake to review before submission

### Feb 4, 2026
- Removed Hub, health tips from product emails
- Default topics + topic persistence shipped
- Preparing for App Store submission (see checklist in notes)
- **[dev branch]** Added Terms of Service page (/terms) — required for App Store
- **[dev branch]** Added Support page (/support) with FAQ + contact — required by Apple
- **[dev branch]** Added global footer with Privacy, Terms, Support links

### Feb 18, 2026
- **[dev branch]** Added dynamic OG/Twitter images for social sharing
  - opengraph-image.tsx generates 1200x630 OG image
  - twitter-image.tsx generates Twitter card image
  - Updated metadata: summary_large_image card, added creator @jschorr21, added canonical URL
  - Improves appearance when Briefing is shared on social media
