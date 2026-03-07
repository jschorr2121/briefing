# Briefing iOS App — Strategy & Launch Guide

## 1. How Updates Work (Backend + App Store)

### Backend (Next.js on Vercel)
- Push to `master` → Vercel auto-deploys. Changes are live instantly for all users (web and iOS).
- The iOS app calls your Vercel-hosted API, so backend changes (new features, bug fixes, model upgrades) take effect immediately without any app update.
- This is the biggest advantage of a shared-backend architecture: **most improvements don't require an App Store update.**

### iOS App Updates
- UI changes, new screens, local features (offline history, new animations, settings) require a new app build submitted to the App Store.
- **The process:** Make changes → increment version in Xcode (e.g. 1.0.1) → Archive → Submit to App Store Connect → Apple reviews (typically 24-48 hours) → Release.
- Users on auto-update get it within a day of release. Others update manually.
- **Strategy:** Keep as much logic on the backend as possible. Use feature flags (a simple JSON endpoint) to toggle features without app updates.

### What lives where:
| Change | Where | App Update Needed? |
|--------|-------|--------------------|
| New AI model | Backend | No |
| New topic suggestions | Backend (API) or iOS (AppConfig) | Optional |
| Price changes | App Store Connect | No |
| New UI screen | iOS app | Yes |
| Bug in briefing generation | Backend | No |
| Bug in audio player | iOS app | Yes |
| New voice options | Backend + iOS | Yes (for UI) |

---

## 2. Getting on the App Store

### Prerequisites
1. **Apple Developer Account** ($99/year) — enroll at developer.apple.com if you haven't already
2. **App icon** — 1024x1024 PNG, no transparency, no rounded corners (Apple rounds them)
3. **Screenshots** — Required for each device size (6.7" iPhone, 6.1" iPhone minimum). Run the app in simulator, take screenshots of key screens (login, briefing, audio player, schedules)
4. **Privacy Policy URL** — Required. Host a simple page explaining data collection (Google account info, email for schedules, usage analytics)
5. **App Store description, keywords, subtitle** — see marketing section below

### Submission Steps
1. **App Store Connect** — Create a new app at appstoreconnect.apple.com
   - Bundle ID: `com.briefing.app`
   - SKU: `briefing-ios`
   - Primary language: English
2. **Create subscription products** (if launching with Pro tier)
   - Subscription group: "Briefing Pro"
   - `com.briefing.pro.monthly` — $6.99/month
   - `com.briefing.pro.annual` — $49.99/year
   - Fill in subscription metadata, review notes
3. **In Xcode** — Select the Briefing target → Product → Archive
   - This builds an optimized release build
   - In the Organizer window, click "Distribute App" → App Store Connect
   - Upload and wait for processing (5-15 min)
4. **Back in App Store Connect** — Select the uploaded build, fill in:
   - Screenshots (minimum 3)
   - Description, keywords, subtitle
   - Age rating (4+ for news)
   - Privacy policy URL
   - Review notes: "Sign in with Google to generate AI news briefings. Test account: [provide a test Google account]"
5. **Submit for review** — Apple typically reviews within 24-48 hours
6. **Release** — Choose manual or automatic release after approval

### Common Rejection Reasons to Avoid
- Missing privacy policy
- In-app purchases not working in sandbox
- App crashes on launch
- Placeholder content visible
- Not explaining why you need sign-in (add a "why Google?" note)

---

## 3. Features & Improvements Before Launch

### Must-Have Before App Store
- [ ] **App icon** — Professional, recognizable, matches the brand
- [ ] **Onboarding flow** — First-launch tutorial (3 screens: pick topics → generate → listen). Users need to understand value before signing in
- [ ] **Offline support** — Cache last briefing locally so users see content even without internet
- [ ] **Pull-to-refresh** — Standard iOS pattern for reloading briefings
- [ ] **Push notifications** — "Your morning briefing is ready" for scheduled users
- [ ] **Loading states polish** — Ensure every loading state feels smooth (skeleton screens are in, but test edge cases)
- [ ] **Error handling polish** — User-friendly messages for every failure (no internet, server down, etc.)
- [ ] **Privacy policy page** — Required by Apple

### High-Value Features for Post-Launch
- [ ] **Widget** — iOS home screen widget showing today's top headline per topic. This is a massive engagement driver.
- [ ] **Apple Watch companion** — Brief summary on the wrist, "Hey Siri, read my briefing"
- [ ] **Siri Shortcuts** — "Generate my briefing" voice command
- [ ] **Live Activities** — Show briefing generation progress on Dynamic Island
- [ ] **Spotlight search** — Index briefing history so users can search past briefings from home screen
- [ ] **Share extension** — Share articles from Safari into Briefing as topics
- [ ] **Personalization engine** — Track which stories users tap/expand, weight future briefings accordingly
- [ ] **Briefing podcast mode** — Auto-generate daily audio briefing with transitions, intro/outro music
- [ ] **Social sharing cards** — Beautiful OG-image-style cards when users share a briefing
- [ ] **Multi-language** — Briefings in Spanish, French, German, etc.

### Overall Vision

Briefing should be **the first app people open every morning.** The north star is replacing the doomscrolling habit with a focused, personalized, 5-minute news experience.

The moat is the combination of:
1. **Personalization** — AI-curated to exactly what the user cares about (not what drives clicks)
2. **Multiple formats** — Read, listen, or receive via email — fits any routine
3. **Brevity** — Respects the user's time. Not infinite scroll. A complete briefing in 3-5 minutes.
4. **Quality** — Real-time web search means always current. Story cards with sources mean trustworthy.

The app should feel like having a personal news editor who knows exactly what you care about, delivers a tight briefing every morning, and never wastes your time.

**Competitive positioning:** Existing apps (Apple News, Google News, Artifact) are recommendation engines that still require browsing. Briefing is a **generation engine** — it produces a finished product, not a feed. This is the key differentiator.

---

## 4. Marketing Strategy

### Pre-Launch (2-4 weeks before)
- **Landing page** — briefing-app.com with email signup, app preview video, "Coming to iOS" badge
- **Product Hunt launch** — Prepare a compelling launch post. Schedule for a Tuesday (highest traffic). Get 5-10 people to upvote and comment at launch
- **Twitter/X thread** — "I built an AI app that replaces your morning news routine. Here's what I learned." Dev story threads perform well.
- **Reddit** — Post in r/sideproject, r/startups, r/iphone, r/artificial. Focus on the problem ("I was spending 45 min doomscrolling every morning") not the product.
- **Hacker News** — "Show HN: Briefing — AI-generated personalized news briefings." Sunday evening posts get more visibility.

### Launch Week
- **App Store Optimization (ASO)**
  - Title: "Briefing — AI News Summary"
  - Subtitle: "Your personalized daily briefing"
  - Keywords: news,AI,briefing,summary,podcast,daily,personalized,newsletter,headlines,morning
  - Description: Lead with the problem, show the solution, list features, end with social proof
- **Press outreach** — Email 10-15 tech bloggers/podcasters who cover AI tools or productivity apps
- **Social proof** — Get 10+ 5-star ratings in the first week (ask friends, family, early signups)

### Ongoing Growth
- **Content marketing** — Weekly blog post: "This Week in AI" or "5 Stories You Missed" — drives SEO traffic to the landing page
- **Referral program** — "Share Briefing with a friend, both get 1 week of Pro free"
- **TikTok/Reels** — Short demos: "POV: You replaced Twitter with this app" — show the morning routine
- **Newsletter swap** — Partner with small newsletters to cross-promote
- **App Store features** — Apple features apps that use native APIs well. Use widgets, Live Activities, Siri Shortcuts to increase chances.

### Retention Tactics
- **Morning push notification** — "Your briefing is ready" at the user's preferred time
- **Weekly recap email** — "You read about 23 topics this week. Here's what you engaged with most."
- **Streak counter** — "5-day briefing streak! 🔥" — gamify the daily habit
- **Progressive onboarding** — Reveal features over the first week (day 1: generate, day 2: audio, day 3: schedules, day 4: email)

---

## 5. Financial Analysis

### Revenue Model
- **Freemium + Subscription (IAP)**
  - Free: 3 briefings/day, 2 topics/briefing
  - Pro: $6.99/month or $49.99/year — unlimited briefings, unlimited topics, all voices, priority generation

### Cost Structure (Monthly)

| Cost | Amount | Notes |
|------|--------|-------|
| OpenAI API (Responses + TTS) | ~$0.05-0.15/briefing | Web search + generation + audio |
| Vercel hosting | $0 (hobby) or $20/mo (Pro) | Pro needed for longer function timeouts |
| Apple Developer Program | $8.25/mo ($99/yr) | Required for App Store |
| Upstash Redis | $0-10/mo | Free tier covers early usage |
| Gmail SMTP | $0 | Using existing account |
| **Total fixed costs** | **~$30/mo** | Before any users |

### Per-User Economics

| Metric | Free User | Pro User |
|--------|-----------|----------|
| Revenue/month | $0 | $6.99 (monthly) or $4.17 (annual) |
| API cost/month (est. 20 briefings) | ~$2 | ~$6 |
| Gross margin | -$2 | +$1 to +$5 |
| Apple's 30% cut (year 1) | — | -$2.10 (monthly) |
| Apple's 15% cut (year 2+) | — | -$1.05 (monthly) |
| **Net per Pro user (year 1)** | **-$2** | **~$1-2/mo** |
| **Net per Pro user (year 2+)** | **-$2** | **~$2-4/mo** |

### Short-Term (0-6 months)

**Realistic scenario:**
- 500 downloads in first month (Product Hunt + social + organic)
- 5% conversion to Pro = 25 paying users
- Revenue: ~$175/month (mix of monthly and annual)
- Costs: ~$80/month (hosting + API costs for 500 users)
- **Net: ~$95/month profit**

**Optimistic scenario:**
- 2,000 downloads in first month
- 8% conversion = 160 paying users
- Revenue: ~$1,100/month
- Costs: ~$250/month
- **Net: ~$850/month profit**

### Long-Term (6-24 months)

**Growth trajectory (conservative):**

| Month | Total Users | Pro Subscribers | MRR | Monthly Costs | Net |
|-------|------------|----------------|-----|--------------|-----|
| 1 | 500 | 25 | $175 | $80 | $95 |
| 3 | 1,500 | 75 | $525 | $150 | $375 |
| 6 | 4,000 | 250 | $1,750 | $400 | $1,350 |
| 12 | 10,000 | 700 | $4,900 | $900 | $4,000 |
| 24 | 25,000 | 2,000 | $14,000 | $2,500 | $11,500 |

### Key Levers for Revenue Growth

1. **Reduce API costs** — Cache popular topic briefings (already partially built with the cron system). If 50 users all want "AI & Tech," generate it once.
2. **Increase conversion rate** — The free tier should feel useful but limited. The limit of 2 topics is the strongest upgrade motivator ("you can only see 2 of your 5 selected topics").
3. **Annual plan push** — Annual subscribers have higher LTV and lower churn. Offer 40% savings vs monthly ($49.99/yr vs $83.88/yr).
4. **Reduce churn** — Push notifications, streaks, and email schedules create daily habits. Target <5% monthly churn.
5. **B2B/Team plan** — Later: "Briefing for Teams" at $15/user/month. Companies buy it for their executives to stay informed. Higher margins, lower churn.
6. **Premium tier** — $14.99/month for real-time briefings, custom AI models, API access, white-label reports.

### Break-Even Analysis
- Fixed costs: ~$30/month
- Variable cost per Pro user: ~$4/month (API + Apple cut)
- Net revenue per Pro user: ~$3/month
- **Break-even: ~10 Pro subscribers**

### The Big Picture
This is a low-cost, high-margin SaaS business once you pass the initial growth phase. The AI costs per user decrease as you implement caching and batching. The subscription model creates predictable recurring revenue. The key risk is churn — if users don't form a daily habit, they cancel. Everything in the product and marketing should focus on making Briefing part of the user's morning routine.

---

## 6. What We Did Today & Where We Are

### What was built (Feb 13, 2026)

**Backend (Next.js — existing repo):**
- Created `src/lib/mobile-auth.ts` — Token-based auth system using `brf_` prefixed tokens stored in Redis with 30-day TTL
- Created `src/lib/auth-helper.ts` — Unified `getAuthenticatedUser()` that checks Bearer token (mobile) first, falls back to NextAuth session (web)
- Created `POST /api/auth/mobile-login` — Accepts Google ID token, verifies with Google, returns session token + user info
- Created `POST /api/auth/mobile-logout` — Revokes a bearer token from Redis
- Created `POST /api/subscription/verify-receipt` — Accepts StoreKit 2 transaction JWS, upgrades user to Pro in Redis
- Updated 5 existing API routes (`generate`, `schedules`, `subscription`, `stripe/create-checkout`, `stripe/create-portal`) to use `getAuthenticatedUser()` instead of `getServerSession()` — fully backward compatible with the web app
- Pushed all changes to master, deployed to Vercel

**iOS App (new repo at `briefing-ios/`):**
- Created a full native SwiftUI app with 44 Swift files, all compiling with 0 errors
- **Architecture:** Models → Services → ViewModels → Views (MVVM)
- **Auth:** Google Sign-In SDK integration, Keychain token storage, session restore on app launch
- **Networking:** Actor-based APIClient with Bearer auth, retry/backoff, 401 auto-signout, 429 upgrade prompt
- **Core features:** Topic selection, briefing generation, story card carousel, audio playback with lock screen controls, email send, markdown export, briefing history (SwiftData, limited to 10)
- **Schedules:** Full CRUD — create, edit, delete, toggle schedules
- **Account:** Profile card, usage tracking with progress bar, subscription status
- **Pricing:** StoreKit 2 integration with monthly/annual products, purchase flow, restore purchases, backend receipt verification
- **UI:** Dark theme matching web app, custom color system, typography scale, animations (fade-in, slide-in, shimmer loading), haptic feedback, flow layout for topic chips
- **Xcode project:** Generated via xcodegen with `project.yml` for easy regeneration, iOS 17.0+ target, background audio capability

### Current Status
- iOS app **builds and runs** in the simulator
- Google Sign-In **works** (user successfully signed in)
- Backend API **is connected** (app hits Vercel endpoints)
- Briefing generation is failing due to a **pre-existing OpenAI API timeout issue** on Vercel — not caused by today's changes. The OpenAI Responses API with web search is slow and exceeds Vercel's function timeout.

### Immediate Next Steps
1. **Fix the Vercel timeout issue** — Either upgrade to Vercel Pro ($20/mo) for 60-second function timeouts, or add streaming/chunked responses, or try a faster model
2. **Add `GOOGLE_IOS_CLIENT_ID` env var on Vercel** — So the backend properly verifies iOS tokens (instead of falling back to the web client ID)
3. **Add the URL scheme in Xcode** — `com.googleusercontent.apps.814427665682-4chioe564tgqo9920satjmciivad2f1c` under URL Types for Google Sign-In redirect
4. **Test the full flow end-to-end** once the timeout issue is resolved — generate, audio, email, schedules, history
5. **Add an app icon**

### Before App Store Submission
- Onboarding flow for new users
- Push notifications for scheduled briefings
- Privacy policy page
- App Store screenshots and metadata
- TestFlight beta testing with a few users
- Polish error states and edge cases

---

## 7. Running the App on Your Physical iPhone (Without the App Store)

Yes — you can install and use the app on your own iPhone without publishing to the App Store. Two ways:

### Option A: Direct from Xcode (easiest)
1. Plug your iPhone into your Mac via USB (or use Wi-Fi after first pairing)
2. On your iPhone: go to **Settings → Privacy & Security → Developer Mode** → turn it ON (restart required)
3. In Xcode, select your iPhone as the build destination (top bar dropdown — it will appear by name)
4. Press **Cmd+R** to build and run
5. The first time, your iPhone will ask you to trust the developer certificate: go to **Settings → General → VPN & Device Management** → tap your Apple ID → Trust
6. The app installs and launches on your phone

**Limitation:** The app expires after 7 days with a free Apple Developer account, or stays indefinitely with a paid $99/year account. You just re-run from Xcode to refresh it.

### Option B: TestFlight (best for sharing with others)
1. Requires a paid Apple Developer account ($99/year)
2. In Xcode: **Product → Archive** → **Distribute App → TestFlight Internal Only** (or App Store Connect for external)
3. Upload to App Store Connect
4. In App Store Connect, add testers by email (up to 100 internal testers, 10,000 external)
5. Testers get an invite, download the **TestFlight app** from the App Store, and install your app
6. TestFlight builds last 90 days
7. No App Store review needed for internal testers (external testers require a quick beta review)

**TestFlight is the recommended path** — it lets you test on your phone and share with friends/beta users before the full App Store launch. It's also how you'd do a soft launch to gather feedback.

### Quick Summary
| Method | Cost | Duration | Can Share? |
|--------|------|----------|------------|
| Xcode → USB | Free | 7 days (free) / unlimited (paid) | No, just your devices |
| TestFlight Internal | $99/year | 90 days per build | Up to 100 people |
| TestFlight External | $99/year | 90 days per build | Up to 10,000 people |
| App Store | $99/year | Permanent | Everyone |

---

## 8. TestFlight Step-by-Step Guide

### One-Time Setup

1. **Enroll in the Apple Developer Program** ($99/year)
   - Go to https://developer.apple.com/programs/enroll/
   - Sign in with your Apple ID
   - Pay the $99 fee
   - Takes up to 48 hours to process (usually faster)

2. **Set up App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - Click **My Apps → + → New App**
   - Fill in:
     - Platform: iOS
     - Name: Briefing
     - Primary Language: English (U.S.)
     - Bundle ID: `com.briefing.app` (select from dropdown — if not there, register it at developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → + → App ID)
     - SKU: `briefing-ios`
   - Click **Create**

3. **Set your team in Xcode**
   - Open the project in Xcode
   - Click the **Briefing** project → **Briefing** target → **Signing & Capabilities**
   - Under **Team**, select your Apple Developer account (not "Personal Team")
   - Xcode will automatically create provisioning profiles

### Uploading a Build

4. **Archive the app in Xcode**
   - Select **Any iOS Device** as the build destination (not a simulator)
   - Go to **Product → Archive**
   - Wait for the build to complete (1-3 minutes)
   - The **Organizer** window opens automatically

5. **Upload to App Store Connect**
   - In the Organizer, select the archive you just created
   - Click **Distribute App**
   - Select **TestFlight & App Store** (or **TestFlight Internal Only** for faster turnaround)
   - Click **Distribute** (use all the defaults)
   - Wait for upload to complete (2-5 minutes)
   - You'll get an email from Apple when processing is done (5-15 minutes)

### Adding Testers

6. **Add yourself as a tester**
   - Go to App Store Connect → your app → **TestFlight** tab
   - Under **Internal Testing**, click **+** next to "App Store Connect Users"
   - Add your Apple ID email
   - You'll receive a TestFlight invite email

7. **Install on your phone**
   - On your iPhone, download the **TestFlight** app from the App Store (it's free, made by Apple)
   - Open the invite email on your phone, or open TestFlight and accept the invite
   - Tap **Install** next to Briefing
   - The app installs on your home screen — works like any normal app, no Mac needed

### Adding Other Testers

8. **Internal testers** (up to 100, no review needed)
   - App Store Connect → TestFlight → Internal Testing → add emails
   - They must have an Apple ID and the TestFlight app
   - Builds are available to them immediately after processing

9. **External testers** (up to 10,000, requires quick beta review)
   - App Store Connect → TestFlight → External Testing → Create Group → Add Testers
   - You can also create a **public link** — anyone with the link can join (up to 10,000)
   - First build requires Apple's beta review (~24 hours), subsequent builds are usually instant
   - Great for sharing on social media: "Beta test my app → [TestFlight link]"

### Updating the App on TestFlight

10. **Push an update**
    - Make your code changes
    - Increment the build number in Xcode (target → General → Build, e.g. 1 → 2)
    - **Product → Archive → Distribute App** (same as step 4-5)
    - TestFlight testers get a notification that a new build is available
    - They tap **Update** in the TestFlight app

### Tips
- You don't need to fill in App Store metadata (description, screenshots) for TestFlight — that's only needed for the actual App Store submission
- TestFlight builds expire after **90 days** — just upload a new build before then
- You can have multiple builds active at once and assign different builds to different test groups
- Add **"What to Test"** notes when uploading so testers know what's new
- TestFlight automatically collects crash reports — view them in App Store Connect → TestFlight → Crashes
