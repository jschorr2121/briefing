# Briefing

**Your Personal News Intelligence**

AI-powered news briefings based on your interests. Choose topics, generate briefings with real-time news, listen via audio, get daily scheduled emails, and export as markdown.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, dark theme
- **iOS App**: Native Swift/SwiftUI with Xcode
- **Auth**: NextAuth.js with Google OAuth (web), Google Sign-In (iOS)
- **News Data**: Perigon News API (article search + vector/semantic search)
- **AI Assembly**: OpenAI GPT-5-nano (briefing text generation)
- **Audio**: OpenAI TTS API (with chunking for long briefings)
- **Email**: Gmail SMTP (nodemailer) for scheduled briefings
- **Payments**: Stripe Checkout (web), StoreKit 2 (iOS)
- **Storage**: Upstash Redis (schedules, briefing cache, usage tracking)
- **Hosting**: Vercel

## Features

- 📰 **42 Curated Topics** across Tech, Sports, Finance, Science, Politics, Lifestyle, Entertainment
- 🔍 **Perigon News API** for structured, high-quality article data
- 🧠 **Semantic Search** for niche topics via vector search
- 🎧 **Text-to-Speech** with 6 OpenAI voices and speed control
- 📧 **Scheduled Emails** with daily briefing delivery
- 📱 **Native iOS App** built with Swift/SwiftUI
- 📤 **Export to Markdown**

## Getting Started

### Prerequisites

- Node.js 18+
- npm/pnpm
- OpenAI API key
- Perigon API key

### Installation

```bash
cd briefing

npm install

cat > .env.local << EOF
OPENAI_API_KEY=your_openai_key
PERIGON_API_KEY=your_perigon_key
KV_REST_API_URL=your_upstash_url
KV_REST_API_TOKEN=your_upstash_token
EOF

npm run dev
```

Visit `http://localhost:3000`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key (GPT-5-nano + TTS) | Yes |
| `PERIGON_API_KEY` | Perigon News API key | Yes |
| `KV_REST_API_URL` | Upstash Redis REST URL | Yes |
| `KV_REST_API_TOKEN` | Upstash Redis REST token | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `NEXTAUTH_SECRET` | NextAuth session secret | Yes |
| `NEXTAUTH_URL` | App base URL | Yes |
| `SMTP_USER` | Gmail address for sending emails | For email |
| `SMTP_PASS` | Gmail app password | For email |
| `NEWS_SOURCE` | `perigon` (default), `openai`, or `perplexity` | No |

## Project Structure

```
briefing/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/          # Briefing generation API
│   │   │   ├── audio/             # TTS API
│   │   │   ├── email/             # Email delivery
│   │   │   ├── topics/            # Topic browsing & custom creation
│   │   │   ├── cron/              # Scheduled generation & sending
│   │   │   ├── schedules/         # User schedule management
│   │   │   ├── subscription/      # Subscription status & receipts
│   │   │   └── auth/              # Auth endpoints (web + mobile)
│   │   ├── page.tsx               # Main briefing page
│   │   ├── schedule/              # Schedule management page
│   │   └── pricing/               # Pricing page
│   └── lib/
│       ├── perigon.ts             # Perigon News API client
│       ├── topic-engine.ts        # 42 curated topics + custom topic creation
│       ├── briefing-generator.ts  # Core pipeline: Perigon → GPT-5-nano → briefing
│       ├── perigon-cache.ts       # Redis caching for articles & sections
│       ├── prompts.ts             # LLM prompt templates
│       ├── models.ts              # OpenAI model config
│       └── filter-stories.ts      # Story deduplication & filtering
├── briefing-ios/                  # Native iOS app (Swift/SwiftUI)
│   └── Briefing/
│       ├── Configuration/
│       │   └── AppConfig.swift    # API base URL & app config
│       ├── Services/
│       │   ├── APIClient.swift    # Network client (all API calls)
│       │   ├── AuthManager.swift  # Google Sign-In + token management
│       │   ├── BriefingService.swift
│       │   ├── ScheduleService.swift
│       │   └── SubscriptionService.swift
│       └── Views/                 # SwiftUI views
├── .env.local                     # Environment variables (not committed)
└── README.md
```

## iOS App

The native iOS app lives in `briefing-ios/` and is built with Swift/SwiftUI in Xcode.

### How the iOS App Connects to the Backend

All API calls go through `APIClient.swift`, which uses a base URL defined in `AppConfig.swift`:

```swift
// briefing-ios/Briefing/Configuration/AppConfig.swift
static let baseURL = "https://briefing-five.vercel.app"
```

Every request prepends this URL to API paths (e.g. `/api/generate`, `/api/subscription`). Auth tokens from Google Sign-In are stored in the iOS Keychain and attached as `Authorization: Bearer` headers.

### Testing Against a Preview Branch

When working on a feature branch (e.g. `perigon-integration`), Vercel creates an automatic preview deployment. To test the iOS app against it:

1. Push the branch: `git push origin your-branch`
2. Find the preview URL in the Vercel dashboard (e.g. `https://briefing-git-perigon-integration-jschorr2121s-projects.vercel.app`)
3. Temporarily update the base URL in `AppConfig.swift`:
   ```swift
   static let baseURL = "https://briefing-git-perigon-integration-jschorr2121s-projects.vercel.app"
   ```
4. Build and run in the Xcode simulator
5. Switch back to the production URL before committing

### API Endpoints Used by iOS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/mobile-login` | POST | Login with Google ID token |
| `/api/auth/mobile-logout` | POST | Sign out |
| `/api/generate` | POST | Generate briefings |
| `/api/audio` | POST | Generate TTS audio |
| `/api/email` | POST | Send briefing via email |
| `/api/schedules` | GET/POST/PUT/DELETE | Manage scheduled briefs |
| `/api/subscription` | GET | Subscription status |
| `/api/subscription/verify-receipt` | POST | Verify StoreKit receipt |
| `/api/topics` | GET | Browse curated topics |
| `/api/topics/custom` | POST | Create custom topic (auth required) |

## Deployment

- Push to `master` auto-deploys to Vercel production
- Feature branches get automatic Vercel preview deployments
- iOS: Build and archive in Xcode for App Store submission

## License

MIT
