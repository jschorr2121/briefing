# Dev Branch Review Summary

**Last production deploy:** Feb 16, 2026
**Commits pending:** 13

## Changes Ready for Merge

### 🔒 Legal & Compliance
- **Terms of Service** (`/terms`) — Required for App Store
- **Support page** (`/support`) — FAQ + contact info, required by Apple
- **Site-wide footer** — Links to Privacy, Terms, Support

### 📈 SEO & Social
- **robots.txt** — Allows crawling, blocks API/auth routes
- **sitemap.xml** — All public pages with priorities
- **OG/Twitter meta tags** — Better link previews when shared
- **Dynamic OG images** — Auto-generated 1200x630 images for social sharing

### 🛠️ Infrastructure
- **/api/health endpoint** — Checks Redis connectivity, validates env vars
- **Cron timeout fixes** — Added `maxDuration = 60`, batch limits (max 3 generate, max 5 send)
  - Note: If more than 3 users, may need Vercel Pro or multiple cron runs

### 📱 App Store Prep
- **App Store listing copy** (`docs/app-store-listing.md`)
- **Google Play listing copy** (`docs/google-play-listing.md`)

## To Merge

```bash
git checkout master
git merge dev
git push
```

Or create a PR on GitHub for formal review.
