# Briefing — Project Context

## What It Is
Personalized AI news briefing app. Users pick topics, AI searches the web and generates polished news summaries. Available as text, audio (12 voices), email, or markdown export.

## Live URL
https://briefing-five.vercel.app

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Auth | NextAuth.js + Google OAuth |
| AI | OpenAI Responses API with `web_search` tool |
| Audio | OpenAI TTS API (chunked for long briefings) |
| Email | Gmail SMTP via nodemailer |
| Payments | Stripe Checkout (subscription) |
| Storage | Upstash Redis (schedules, cache, usage) |
| Hosting | Vercel (auto-deploy from GitHub) |
| Mobile | Capacitor (iOS + Android WebView shell) |

## Repo Structure
```
briefing/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main briefing page (topic select → generate → display)
│   │   ├── layout.tsx            # Root layout (metadata, viewport, providers)
│   │   ├── login/page.tsx        # Google OAuth login
│   │   ├── account/page.tsx      # Account settings, subscription management
│   │   ├── pricing/page.tsx      # Free vs Pro comparison + Stripe checkout
│   │   ├── schedule/page.tsx     # Set up daily email briefings
│   │   ├── privacy/page.tsx      # Privacy policy (required for App Store)
│   │   └── api/
│   │       ├── generate/route.ts         # On-demand briefing generation
│   │       ├── audio/route.ts            # TTS generation (OpenAI, chunked)
│   │       ├── email/route.ts            # Send briefing via email
│   │       ├── subscription/route.ts     # Check user subscription status
│   │       ├── schedules/route.ts        # CRUD for scheduled briefings
│   │       ├── auth/[...nextauth]/       # NextAuth config
│   │       ├── stripe/                   # Checkout, portal, prices
│   │       ├── webhooks/stripe/          # Stripe webhook handler
│   │       ├── admin/schedules/          # Admin schedule management
│   │       └── cron/
│   │           ├── generate-briefs/      # Pre-generate briefings (runs before send)
│   │           └── send-briefs/          # Send scheduled emails
│   ├── components/
│   │   ├── TopicSelector.tsx     # Add/remove topics with suggestions
│   │   ├── BriefingCard.tsx      # Renders a briefing with story cards
│   │   ├── GenerateButton.tsx    # Main CTA
│   │   ├── Header.tsx            # Nav header with settings
│   │   ├── SettingsModal.tsx     # Briefing length, tone, voice
│   │   ├── HistoryPanel.tsx      # Past briefings (localStorage)
│   │   ├── AuthGuard.tsx         # Requires login
│   │   ├── UpgradeModal.tsx      # Upsell when free limit hit
│   │   └── Providers.tsx         # SessionProvider + Toast + Capacitor init
│   ├── hooks/
│   │   ├── useSubscription.ts    # Pro/free status, usage tracking
│   │   └── useKeyboardShortcuts.ts
│   └── lib/
│       ├── types.ts              # Topic, Briefing, StoryCard, Settings types
│       ├── stripe.ts             # Stripe client init
│       ├── subscription.ts       # Subscription helper functions
│       ├── schedules.ts          # Redis-backed schedule CRUD
│       ├── models.ts             # OpenAI model selection
│       ├── capacitor.ts          # Native bridge (status bar, splash, haptics, push)
│       └── utils.ts              # Reading time, IDs, sharing
├── ios/                          # Capacitor iOS project (Xcode)
├── android/                      # Capacitor Android project
├── resources/                    # App icons + splash screens
├── public/                       # Favicon, PWA manifest, icons
├── capacitor.config.ts           # Mobile app config
├── MOBILE_SETUP.md               # iOS/Android build + App Store guide
├── APP_STORE_LISTING.md          # Ready-to-use App Store metadata
└── CLAUDE.md                     # Development log
```

## Core User Flow
1. Login with Google
2. Add topics (free-form text or pick from suggestions: AI & Tech, Finance, World News, Sports, etc.)
3. Click "Generate Briefing" → OpenAI Responses API searches the web per topic → returns structured JSON with summary + story cards + source URLs
4. View briefing cards with expandable stories, source links
5. Optional: Listen (pick voice → TTS), Email, Export as markdown
6. Optional: Set up daily scheduled delivery at `/schedule`

## Data Model
- **Topics**: Client-side only (localStorage). Array of `{id, name, emoji, enabled}`.
- **Briefings**: Generated on-demand via API. Cached in localStorage for history.
- **Schedules**: Stored in Upstash Redis. `{userId, email, topics[], frequency, time, timezone, enabled}`.
- **Subscriptions**: Managed by Stripe. Status checked via `/api/subscription`.
- **Usage**: Tracked in Redis per user per day. Free tier = 3/day.

## Subscription Model
- **Free**: 3 briefings/day, all features
- **Pro**: Unlimited briefings, scheduled email delivery
- Stripe Checkout for payment, Stripe Customer Portal for management
- Webhook updates subscription status in Redis

## Cron System (Vercel)
1. `generate-briefs` runs first — generates briefings for all schedules, caches in Redis
2. `send-briefs` runs after — reads cache, sends formatted HTML emails via SMTP
3. Split into two steps to stay within Vercel's function timeout limits

## Mobile (Capacitor)
- WebView shell loading the Vercel URL (not a static export)
- Native plugins: splash screen, status bar, push notifications, haptics, keyboard handling, back button
- Payments handled on web (avoids Apple's 30% IAP requirement)
- Config: `capacitor.config.ts`, bridge: `src/lib/capacitor.ts`

## Design
- Dark theme (#0a0a0a background)
- Blue accent (#60a5fa / #3b82f6)
- Responsive — works on mobile and desktop
- Story cards in horizontal scroll per topic

## Environment Variables (Vercel)
```
OPENAI_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
KV_REST_API_URL          # Upstash Redis
KV_REST_API_TOKEN
SMTP_USER                # Gmail
SMTP_PASS                # Gmail app password
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_ANNUAL_PRICE_ID
CRON_SECRET              # Vercel cron auth
```

## Current Status (Feb 2026)
- 3 active users on daily scheduled briefings
- Web app fully functional
- Mobile scaffolding complete, needs build on Mac + App Store submission
- Stripe integration built, env vars need to be set on Vercel
