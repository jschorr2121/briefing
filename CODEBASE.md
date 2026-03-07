# Briefing — Complete Project Reference

AI-powered personalized news briefing app. Users pick topics, generate briefings via real-time web search, listen via TTS audio, get daily scheduled email digests, and export as markdown.

**Live**: briefing-five.vercel.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web frontend | Next.js 14 (App Router), React 18, Tailwind CSS 4, dark theme |
| iOS app | SwiftUI, MVVM, SwiftData, StoreKit 2 |
| Auth | NextAuth.js (Google OAuth) on web; Google Sign-In + Bearer tokens on iOS |
| AI / Search | OpenAI Responses API (web_search tool) or Perplexity Sonar |
| TTS | OpenAI TTS API (12 voices, chunked for long briefings) |
| Email | Nodemailer + Gmail SMTP |
| Payments | Stripe (web), StoreKit 2 (iOS) |
| Storage | Upstash Redis (subscriptions, schedules, briefing cache, usage) |
| Hosting | Vercel (auto-deploy on push to master) |

---

## Repository Layout

```
Briefing/
├── briefing/              # Next.js web app + API backend
├── briefing-ios/          # Native iOS app (SwiftUI)
└── MD files/              # Miscellaneous docs
```

---

## Part 1: Web App (`briefing/`)

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Main UI — topic selector, generate button, briefing cards, audio player, email/export actions, history panel |
| `/login` | `src/app/login/page.tsx` | Google OAuth sign-in |
| `/account` | `src/app/account/page.tsx` | Profile, daily usage stats, subscription tier, billing portal |
| `/pricing` | `src/app/pricing/page.tsx` | Free vs Pro comparison, Stripe checkout |
| `/schedule` | `src/app/schedule/page.tsx` | Create/edit daily email schedules |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy policy |

### API Routes

**Briefing Generation**

| Endpoint | Description |
|----------|-------------|
| `POST /api/generate` | Main generation — OpenAI web search or Perplexity, date filtering, retry logic |
| `POST /api/audio` | Text-to-speech via OpenAI TTS (12 voices, auto-chunking) |
| `POST /api/email` | Send briefing as formatted HTML email |

**Cron Jobs**

| Endpoint | Description |
|----------|-------------|
| `GET /api/cron/generate-briefs` | Pre-generate briefings for scheduled users, cache in Redis |
| `GET /api/cron/send-briefs` | Send cached briefings via email; fallback: generate on the fly |
| `GET /api/cron/test` | Debug endpoint — runs full generate + send pipeline |

**Auth**

| Endpoint | Description |
|----------|-------------|
| `GET/POST /api/auth/[...nextauth]` | NextAuth Google OAuth handler |
| `POST /api/auth/mobile-login` | iOS login — Google ID token → mobile session (brf_* Bearer token) |
| `POST /api/auth/mobile-logout` | Revoke mobile session |

**Stripe**

| Endpoint | Description |
|----------|-------------|
| `GET /api/stripe/prices` | Returns Pro price IDs |
| `POST /api/stripe/create-checkout` | Create Stripe checkout session |
| `POST /api/stripe/create-portal` | Generate billing portal link |
| `POST /api/webhooks/stripe` | Webhook — subscription lifecycle events |

**Other**

| Endpoint | Description |
|----------|-------------|
| `GET /api/subscription` | User tier, usage stats, limits |
| `POST /api/subscription/verify-receipt` | Apple App Store receipt verification (iOS) |
| `GET/POST/PUT/DELETE /api/schedules` | CRUD for scheduled briefs |
| `GET /api/admin/schedules` | List all schedules (debug/monitoring) |

### Components (`src/components/`)

| Component | Description |
|-----------|-------------|
| `Providers.tsx` | Root wrapper — SessionProvider + ToastProvider |
| `AuthGuard.tsx` | Redirects unauthenticated users to login |
| `Header.tsx` | Top nav — logo, tier badge, profile, sign out |
| `TopicSelector.tsx` | Topic chips + custom topic creation with emoji |
| `BriefingCard.tsx` | Briefing display — summary, story carousel with nav, source links |
| `BriefingStats.tsx` | Reading time + story count |
| `GenerateButton.tsx` | Primary CTA with loading state |
| `SettingsModal.tsx` | Briefing length, tone, voice, links config |
| `AddTopicModal.tsx` | Custom topic form with emoji picker |
| `UpgradeModal.tsx` | Free tier limit prompt |
| `HistoryPanel.tsx` | Previous briefings from localStorage (last 10) |
| `KeyboardHints.tsx` | Shortcut hints (Cmd+G generate, Cmd+, settings, Cmd+E export) |
| `TierBadge.tsx` | FREE / PRO badge |
| `Toast.tsx` | Notification system with context provider |

### Lib (`src/lib/`)

| File | Description |
|------|-------------|
| `prompts.ts` | Centralized LLM prompts — system prompt (search strategy, recency rules, output format) + user message builder with settings |
| `filter-stories.ts` | `filterRecentStories()` — server-side safety net, drops stories >2 months old or future-dated |
| `models.ts` | Model selection via env vars — generation model (gpt-5-nano/gpt-4o/gpt-4o-mini/perplexity) + TTS provider |
| `subscription.ts` | Redis-backed subscription + usage tracking. Free: 3 briefings/day, 2 topics. Pro: unlimited |
| `schedules.ts` | Redis CRUD for scheduled briefs + `shouldSendNow()` timing logic |
| `auth-helper.ts` | Unified auth — checks Bearer token (iOS) then NextAuth session (web) |
| `mobile-auth.ts` | Mobile session management — create/validate/revoke brf_* tokens (30-day TTL in Redis) |
| `stripe.ts` | Stripe client init + `isStripeConfigured()` |
| `types.ts` | Shared TypeScript interfaces (Topic, Article, StoryCard, Briefing, Settings, voice types) |
| `utils.ts` | Helpers — reading time, date formatting, share via Web Share API |

### Hooks (`src/hooks/`)

| Hook | Description |
|------|-------------|
| `useSubscription.ts` | Fetches subscription data — isPro, canGenerate, usage counts |
| `useKeyboardShortcuts.ts` | Global keyboard shortcut listeners |

### Root Config

| File | Description |
|------|-------------|
| `next.config.mjs` | Next.js config (minimal) |
| `vercel.json` | Vercel deployment — cron schedule, function durations |
| `tsconfig.json` | TypeScript config — strict mode, `@/*` path alias |
| `package.json` | Dependencies + scripts (dev, build, start, lint) |
| `postcss.config.mjs` | PostCSS with Tailwind |

### Documentation (in `briefing/`)

| File | Description |
|------|-------------|
| `CLAUDE.md` | Dev log — tech stack, current state, recent changes, key files, deployment |
| `briefing.md` | Full project context — architecture, data model, subscription model, cron system |
| `README.md` | Setup instructions, env vars, features, keyboard shortcuts |
| `APP_STORE_LISTING.md` | App Store submission copy — name, description, keywords, screenshots |
| `STRIPE_SETUP.md` | Step-by-step Stripe integration guide |
| `DEV_CHANGELOG.md` | Development changelog (Feb 3-16, 2026) |
| `DEV_BRANCH_CHANGES.md` | Summary of uncommitted dev branch changes vs master |
| `docs/competitive-landscape.md` | Competitive analysis vs Particle, Concise, TLDR, Morning Brew |
| `docs/monetization-strategy.md` | Pricing rationale, revenue projections, launch phases |

---

## Part 2: iOS App (`briefing-ios/`)

Native SwiftUI app using MVVM architecture. Connects to the same Vercel backend via REST API with Bearer token auth.

### Architecture

```
briefing-ios/
├── Briefing.xcodeproj/
└── Briefing/
    ├── BriefingApp.swift          # @main entry, Google Sign-In config, SwiftData container
    ├── ContentView.swift          # Auth gate → LoginView or MainTabView
    ├── Info.plist                 # App config, Google OAuth URL scheme
    │
    ├── Configuration/
    │   └── AppConfig.swift        # Base URL, client IDs, product IDs, defaults, voice options
    │
    ├── Models/
    ├── ViewModels/
    ├── Views/
    ├── Services/
    └── Extensions/
```

### Models

| File | Description |
|------|-------------|
| `User.swift` | Auth user + LoginResponse |
| `Briefing.swift` | Briefing, StoryCard, Article, GenerateResponse |
| `Topic.swift` | Topic model with flexible initializers |
| `Schedule.swift` | Schedule + frequency enum |
| `Subscription.swift` | Subscription status + usage info |
| `Settings.swift` | BriefingSettings, length/tone enums |
| `BriefingHistory.swift` | SwiftData @Model for local history persistence |

### ViewModels

| File | Description |
|------|-------------|
| `HomeViewModel.swift` | Briefing generation, audio, email, topic management, settings, SwiftData history |
| `AccountViewModel.swift` | Subscription status display, usage metrics |
| `ScheduleViewModel.swift` | Email schedule CRUD + form state |
| `PricingViewModel.swift` | In-app purchase flow + product selection |

### Views

**Home Tab**

| File | Description |
|------|-------------|
| `HomeView.swift` | Main tab — topics, generate, briefing cards, audio, history, settings |
| `TopicSelectorView.swift` | Custom topic input + suggested topics |
| `GenerateButtonView.swift` | CTA button with loading/disabled states |
| `BriefingCardView.swift` | Expandable briefing card with stories |
| `StoryCardView.swift` | Individual story — headline, bullets, source, date |
| `AudioPlayerView.swift` | Playback controls, seek, speed adjustment |
| `VoicePickerView.swift` | TTS voice selection |
| `EmailSheetView.swift` | Email send modal with validation |
| `HistoryListView.swift` | Past briefings with delete/restore |

**Other Tabs**

| File | Description |
|------|-------------|
| `ScheduleView.swift` | Schedule list with toggle/delete |
| `ScheduleFormView.swift` | Create/edit schedule form |
| `AccountView.swift` | Profile, tier badge, usage meter, sign out |
| `LoginView.swift` | Google Sign-In with branding |
| `PricingView.swift` | Plan selector, features, purchase, restore |
| `SettingsView.swift` | Length, tone, links, voice config |

**Shared**

| File | Description |
|------|-------------|
| `ErrorBannerView.swift` | Dismissible error display |
| `LoadingView.swift` | Spinner |
| `TierBadgeView.swift` | Free/Pro badge |
| `UpgradePromptView.swift` | Limit reached → upgrade modal |

### Services

| File | Description |
|------|-------------|
| `AuthManager.swift` | @Observable singleton — Google Sign-In, Keychain token storage, session restore |
| `APIClient.swift` | Actor-based HTTP client — auto Bearer token injection, retry with backoff, error types |
| `BriefingService.swift` | `POST /api/generate`, `POST /api/audio`, `POST /api/email` |
| `ScheduleService.swift` | Schedule CRUD endpoints |
| `SubscriptionService.swift` | Subscription status + receipt verification |
| `StoreKitManager.swift` | @Observable singleton — StoreKit 2 products, purchases, entitlements |
| `AudioPlayerManager.swift` | @Observable AVAudioPlayer wrapper — playback, progress, lock screen controls |
| `HapticManager.swift` | Impact, notification, selection haptics |

### Extensions

| File | Description |
|------|-------------|
| `Color+Theme.swift` | Dark theme palette (accent, backgrounds, text, borders) + hex init |
| `Font+Theme.swift` | Typography scale (hero → caption) |
| `View+Animations.swift` | FadeIn, SlideIn, Shimmer modifiers |

---

## Subscription Tiers

| | Free | Pro |
|---|---|---|
| Daily briefings | 3 | Unlimited |
| Topics per briefing | 2 | Unlimited |
| Audio playback | — | 12 voices |
| Scheduled emails | — | Daily |
| Price (web) | $0 | $6.99/mo or $49.99/yr |

## Data Flow

```
User selects topics → POST /api/generate
  → buildSystemPrompt() + buildUserMessage() from prompts.ts
  → OpenAI Responses API (web_search tool) or Perplexity Sonar
  → parseJSONResponse() → filterRecentStories()
  → Response: { briefings: [...] }

Scheduled emails:
  Cron 1: GET /api/cron/generate-briefs → generate + cache in Redis
  Cron 2: GET /api/cron/send-briefs → read cache → send via SMTP
```

## Environment Variables

```
# Auth
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_IOS_CLIENT_ID
NEXTAUTH_SECRET, NEXTAUTH_URL

# AI
OPENAI_API_KEY, PERPLEXITY_API_KEY
BRIEFING_MODEL (gpt-5-nano | gpt-4o | gpt-4o-mini | perplexity)

# Email
SMTP_USER, SMTP_PASS

# Storage
KV_REST_API_URL, KV_REST_API_TOKEN

# Payments
STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
STRIPE_MONTHLY_PRICE_ID, STRIPE_ANNUAL_PRICE_ID

# Cron
CRON_SECRET
```
