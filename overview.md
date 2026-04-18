# Briefing — Complete Project Overview

## What Is Briefing

Briefing is a personalized AI news briefing app. Users choose topics, generate briefings powered by real-time news search, listen via text-to-speech audio, receive daily scheduled emails, and export as markdown. The app is live at **briefing-five.vercel.app** with active users receiving daily scheduled briefings.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 4, TypeScript 5.9 |
| Auth | NextAuth.js 4 with Google OAuth (web), Bearer token sessions (mobile) |
| News Data | Perigon News API (keyword + semantic/vector search) |
| AI / LLM | OpenAI GPT-5-nano (default), gpt-4o, gpt-4o-mini, Perplexity (configurable) |
| Audio | OpenAI TTS API (12 voices, tts-1 model), Google Cloud TTS (optional) |
| Email | Gmail SMTP via Nodemailer |
| Payments | Stripe Checkout (web), StoreKit 2 (iOS) |
| Storage | Upstash Redis — schedules, briefing cache, usage tracking, query plans, mobile sessions |
| Hosting | Vercel (auto-deploy on push to master) |
| Mobile | Native iOS app (Swift/SwiftUI), Capacitor scaffolding (legacy) |

---

## Project Structure

```
briefing/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main briefing generation UI (28KB)
│   │   ├── layout.tsx                  # Root layout + metadata
│   │   ├── globals.css                 # Global styles + Tailwind
│   │   ├── login/page.tsx              # Google OAuth login
│   │   ├── account/page.tsx            # Profile & subscription management
│   │   ├── pricing/page.tsx            # Pricing & upgrade
│   │   ├── schedule/page.tsx           # Schedule management
│   │   ├── privacy/page.tsx            # Privacy policy
│   │   └── api/
│   │       ├── generate/route.ts       # Briefing generation (POST)
│   │       ├── audio/route.ts          # TTS generation (POST)
│   │       ├── email/route.ts          # Email delivery (POST)
│   │       ├── schedules/route.ts      # CRUD for user schedules
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts   # NextAuth handler
│   │       │   ├── mobile-login/route.ts    # Mobile session creation
│   │       │   └── mobile-logout/route.ts   # Mobile session revocation
│   │       ├── cron/
│   │       │   ├── generate-briefs/route.ts # Pre-generate scheduled briefings
│   │       │   ├── send-briefs/route.ts     # Send scheduled email digests
│   │       │   └── test/route.ts            # Debug endpoint
│   │       ├── topics/
│   │       │   ├── route.ts                 # Browse curated topics
│   │       │   └── custom/route.ts          # Create custom topic
│   │       ├── subscription/
│   │       │   ├── route.ts                 # Subscription status + usage
│   │       │   └── verify-receipt/route.ts  # Apple receipt verification
│   │       ├── stripe/
│   │       │   ├── prices/route.ts          # Stripe price IDs
│   │       │   ├── create-checkout/route.ts # Create checkout session
│   │       │   └── create-portal/route.ts   # Billing portal link
│   │       ├── webhooks/
│   │       │   └── stripe/route.ts          # Stripe webhook handler
│   │       └── admin/
│   │           └── schedules/route.ts       # Admin: list all schedules
│   │
│   ├── components/
│   │   ├── Providers.tsx               # SessionProvider + ToastProvider
│   │   ├── AuthGuard.tsx               # Redirect unauthenticated users
│   │   ├── Header.tsx                  # Top nav (logo, tier badge, profile)
│   │   ├── TopicSelector.tsx           # Topic chips + custom creation
│   │   ├── BriefingCard.tsx            # Briefing display with story carousel (20KB)
│   │   ├── BriefingStats.tsx           # Reading time + story count
│   │   ├── GenerateButton.tsx          # Primary CTA
│   │   ├── SettingsModal.tsx           # Briefing preferences
│   │   ├── AddTopicModal.tsx           # Custom topic form
│   │   ├── UpgradeModal.tsx            # Free tier upgrade prompt
│   │   ├── HistoryPanel.tsx            # Previous briefings dropdown
│   │   ├── KeyboardHints.tsx           # Shortcut display
│   │   ├── TierBadge.tsx               # FREE/PRO indicator
│   │   └── Toast.tsx                   # Notification system
│   │
│   ├── hooks/
│   │   ├── useSubscription.ts          # Subscription state hook
│   │   └── useKeyboardShortcuts.ts     # Global keyboard handler
│   │
│   └── lib/
│       ├── briefing-generator.ts       # Core generation pipeline
│       ├── perigon.ts                  # Perigon News API client
│       ├── perigon-cache.ts            # Redis caching layer for articles
│       ├── query-planner.ts            # Topic resolution & query planning
│       ├── prompts.ts                  # LLM prompt templates
│       ├── filter-stories.ts           # Story deduplication
│       ├── topic-engine.ts             # 42+ curated topics + custom creation
│       ├── auth-helper.ts              # Unified auth (mobile + web)
│       ├── mobile-auth.ts              # Mobile session management (brf_* tokens)
│       ├── subscription.ts             # Tier + usage tracking
│       ├── schedules.ts                # Schedule CRUD + timing logic
│       ├── stripe.ts                   # Stripe client init
│       ├── models.ts                   # Model/provider configuration
│       ├── types.ts                    # TypeScript interfaces
│       └── utils.ts                    # Helpers (reading time, formatting, IDs)
│
├── briefing-ios/                       # Native iOS app (Swift/SwiftUI)
│   └── Briefing/
│       ├── Configuration/AppConfig.swift
│       ├── Services/ (APIClient, AuthManager, BriefingService, ScheduleService, SubscriptionService)
│       └── Views/ (SwiftUI screens)
│
├── public/                             # Static assets (icons, manifest.json)
├── docs/                               # Product documentation
│   ├── topic-pipeline.md              # How topics become briefings
│   ├── competitive-landscape.md       # Market analysis
│   └── monetization-strategy.md       # Business model
│
├── package.json
├── tsconfig.json
├── next.config.mjs
├── vercel.json                         # Deployment config + function durations
├── capacitor.config.ts                 # Mobile config (legacy Capacitor)
├── CLAUDE.md                           # Dev log + project state
├── CODEBASE.md                         # Full code reference
└── MOBILE_SETUP.md                     # iOS/Android build guide
```

---

## Core Architecture

### Briefing Generation Pipeline

The pipeline runs in ~15-20 seconds for 4 topics:

**Stage 1 — Topic Resolution** (`query-planner.ts`)
1. Check 42 curated topics in `topic-engine.ts` for a direct match
2. Check Redis for cached query plans (24-hour TTL)
3. Fall back to LLM batch planning (GPT-5-nano converts custom topics to search queries)
- Returns `QueryInstruction[]` per topic with type: `"articles"`, `"vector"`, or `"both"`

**Stage 2 — Article Fetching** (`perigon.ts`, `perigon-cache.ts`)
- Cascade fallback for keyword search:
  1. Top 100 sources, 3 days, quality filters
  2. All sources, 7 days, quality filters
  3. Vector/semantic search (final fallback)
- Redis caching with 6-hour TTL (query-based, shared across users)

**Stage 3 — Article Merging** (`briefing-generator.ts`)
- Interleave results from multiple queries per topic
- Deduplicate by URL
- Extract title, source, date, summary, URL for LLM input

**Stage 4 — LLM Assembly** (`briefing-generator.ts`, `prompts.ts`)
- GPT-5-nano assembles articles into structured briefing JSON
- Output: summary paragraph + story cards (headline, bullet points, source, URL)
- Topics processed in parallel
- Retry once on failure, fallback to empty briefing

### Authentication

Two auth paths unified in `auth-helper.ts`:
1. **Web**: NextAuth.js session cookie (Google OAuth)
2. **Mobile**: Bearer token (`brf_{64-char hex}`) stored in Redis with 30-day TTL

Auth check order: Bearer token first (mobile), then NextAuth session (web).

### Subscription & Usage

- **Free tier**: 3 briefings/day, 4 topics max
- **Pro tier**: Unlimited briefings and topics
- **Whitelisted users**: `jacobschorr99@gmail.com` (unlimited)
- Usage resets daily at midnight UTC
- Tracked in Redis: `subscription:{email}`, `usage:{email}:{date}`

### Scheduled Briefings

```typescript
interface ScheduledBrief {
  id: string;
  userId: string;
  email: string;
  topics: string[];
  frequency: 'daily' | 'weekdays' | 'weekly';
  time: string;        // "HH:MM"
  timezone: string;    // e.g., "America/New_York"
  enabled: boolean;
  lastSentAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

Two cron jobs power the system:
1. **generate-briefs** — Pre-generates and caches briefings in Redis (`briefing:cache:{email}:{date}`)
2. **send-briefs** — Retrieves cached briefings (or generates on-the-fly) and sends via Gmail SMTP

### Audio (TTS)

- **OpenAI TTS** (default): 12 voices via `tts-1` model. Auto-chunks text at 4096 chars, concatenates MP3 segments.
- **Google Cloud TTS** (optional): Neural2 voices, configured via `TTS_PROVIDER=google`.
- Audio returned as `audio/mpeg` blob.
- Frontend playback with speed controls (0.75x to 2x).

### Payments

- **Web**: Stripe Checkout for subscription management. Webhook handles lifecycle events (created, updated, deleted).
- **iOS**: StoreKit 2 in-app purchases with server-side receipt verification at `/api/subscription/verify-receipt`.

---

## Key TypeScript Types

```typescript
interface Topic {
  id: string;
  name: string;
  emoji: string;
  enabled: boolean;
}

interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  stories?: StoryCard[];
  articles: Article[];
  generatedAt: string;
  readingTime?: number;
  searchProvider?: string;
}

interface StoryCard {
  headline: string;
  bullets: string[];
  source?: string;
  url?: string;
  date?: string;
}

interface Article {
  title: string;
  source: string;
  url: string;
  snippet?: string;
}

interface Settings {
  briefingLength: string;   // "short" | "medium" | "long"
  includeLinks: boolean;
  tone: string;             // "casual" | "professional" | "technical"
  voice: string;
  email?: string;
  autoEmailEnabled?: boolean;
}

interface BriefingHistory {
  id: string;
  briefings: Briefing[];
  generatedAt: string;
  topicNames: string[];
}
```

---

## Environment Variables

### Required

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | NextAuth session encryption |
| `NEXTAUTH_URL` | App base URL (e.g., `https://briefing-five.vercel.app/`) |
| `OPENAI_API_KEY` | OpenAI API (GPT + TTS) |
| `PERIGON_API_KEY` | Perigon News API |
| `KV_REST_API_URL` | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Upstash Redis REST token |
| `SMTP_USER` | Gmail address for sending emails |
| `SMTP_PASS` | Gmail app-specific password |
| `CRON_SECRET` | Secures cron endpoints |

### Optional / Configurable

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEWS_SOURCE` | `perigon` | News provider (`perigon`, `openai`, `perplexity`) |
| `BRIEFING_MODEL` | `gpt-5-nano` | LLM model (`gpt-5-nano`, `gpt-4o`, `gpt-4o-mini`, `perplexity`) |
| `TTS_PROVIDER` | `openai` | TTS engine (`openai`, `google`) |
| `OPENAI_TTS_VOICE` | `nova` | Default TTS voice |
| `STRIPE_SECRET_KEY` | — | Stripe backend key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | — | Stripe frontend key |
| `BRAVE_API_KEY` | — | Brave Search API (legacy) |
| `GOOGLE_TTS_API_KEY` | — | Google Cloud TTS (if using Google) |

---

## Curated Topic System

42 topics across 7 categories, defined in `topic-engine.ts`:

| Category | Topics |
|----------|--------|
| Technology | AI & Tech, Cybersecurity, Startups, Crypto, etc. |
| Business & Finance | Stocks, Banking, Real Estate, Economy |
| Science & Health | General science, health research |
| Sports | NBA, NFL, Soccer, etc. |
| Politics & Government | US politics, world affairs |
| Entertainment & Media | Film, TV, gaming, music |
| Lifestyle & Culture | Food, travel, culture |

Each curated topic includes:
- `displayName` — User-facing label
- `keywordQuery` — Primary Perigon search string
- `vectorPrompt` — Semantic search prompt (for niche topics)
- `perigonTopic` / `perigonCategory` — Perigon taxonomy tags (when available)
- `queryStrategy` — `"articles"`, `"vector"`, or `"both"`

Users can also create unlimited custom topics, which are resolved via the LLM query planner.

---

## Frontend Behavior

### Main Page (`page.tsx`)
- Topic selector grid with enable/disable toggles
- Generate button with loading state
- Voice picker (12 OpenAI voices)
- Briefing cards with horizontal story carousel
- Audio player with speed controls
- Email, export (markdown), and share actions
- Settings modal (length, tone, links)
- History panel (last 10 briefings from localStorage)
- Keyboard shortcuts: Cmd+G (generate), Cmd+, (settings), Cmd+E (export)
- Subscription tier display + upgrade prompt when limits hit

### Client-Side Storage
- **localStorage**: User topics, briefing history, settings preferences
- **Session**: NextAuth cookie (web), Bearer token (mobile)

---

## Deployment & Operations

### Vercel

- Push to `master` triggers auto-deploy to production
- Manual deploy: `curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_dDB96HruN79Qm1VQzc1aulyhz0Vz/vIAVZAlqNx"`
- Function duration limits: 60s for generate, generate-briefs, send-briefs
- Cron schedules configured in `vercel.json` (currently empty array)

### Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

### iOS App

- Native Swift/SwiftUI app in `briefing-ios/`
- Connects to the same API backend
- Auth via Google Sign-In, exchanged for `brf_*` Bearer token
- Build guide in `MOBILE_SETUP.md`

---

## Current State (as of early 2026)

- Web app is live and functional
- 3+ users receiving daily scheduled briefings
- Native iOS app built (Swift/SwiftUI)
- Stripe integration built but env vars not yet configured on Vercel production
- Capacitor scaffolding exists but native iOS app supersedes it
- News Hub feature was removed (unnecessary complexity)
- Health tips removed from scheduled emails (product emails are pure news)
- Default topics for new users: AI & Tech, World News, Finance

---

## Key Patterns & Conventions

- **API routes** use Next.js App Router convention (`route.ts` with exported HTTP method handlers)
- **Auth** is checked at the start of every API route via `getAuthenticatedUser()` from `auth-helper.ts`
- **Redis keys** follow patterns: `subscription:{email}`, `usage:{email}:{date}`, `schedule:{id}`, `briefing:cache:{email}:{date}`, `mobile:session:{token}`, `query:plan:{topicId}`
- **Error handling** in API routes returns `NextResponse.json({ error: "message" }, { status: code })`
- **Parallel processing** is used extensively — topics are generated concurrently via `Promise.all`
- **Dark theme** throughout — dark background with light text, consistent styling
- **Component files** are standalone (no barrel exports / index files)
