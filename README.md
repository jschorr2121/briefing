# Briefing 📰

**Your Personal News Intelligence**

A sleek, dark-themed web app that generates AI-powered news briefings based on your interests. Built with Next.js 16, TypeScript, and Tailwind CSS.

![Briefing Screenshot](screenshot.png)

## Features

- 🎯 **Topic Selection** - Choose from preset topics or add custom ones
- 📰 **Real-Time News** - Fetches latest news via Brave Search API
- ✨ **Clean Dark UI** - Modern, minimal design that's easy on the eyes
- 💾 **Persistent State** - Your preferences are saved locally
- 📤 **Export to Markdown** - Download your briefings for later
- ⚙️ **Customizable** - Adjust briefing length, tone, and link preferences

## Topics

Built-in topics:
- 🤖 AI & Tech
- 📈 Finance
- 🌍 World News
- 🏀 Sports
- 🔬 Science
- 🚀 Startups

Plus, add your own custom topics!

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Brave Search API key (optional, for live news)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd briefing

# Install dependencies
pnpm install

# Create environment file
echo "BRAVE_API_KEY=your_api_key_here" > .env.local

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the app.

### Build for Production

```bash
pnpm build
pnpm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BRAVE_API_KEY` | Brave Search API key for fetching news | No (falls back to RSS) |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **News Sources**: Brave Search API + RSS feeds

## Project Structure

```
briefing/
├── src/
│   ├── app/
│   │   ├── api/generate/   # News generation API
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Main page
│   ├── components/
│   │   ├── BriefingCard.tsx
│   │   ├── GenerateButton.tsx
│   │   ├── Header.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── AddTopicModal.tsx
│   │   └── TopicSelector.tsx
│   └── lib/
│       ├── types.ts        # TypeScript types
│       └── utils.ts        # Utility functions
├── .env.local              # Environment variables
├── package.json
└── README.md
```

## Future Enhancements

- [ ] AI-powered summarization (OpenAI/Anthropic)
- [ ] Audio briefings (TTS)
- [ ] Email delivery
- [ ] Scheduled briefings
- [ ] Mobile app (React Native)
- [ ] User accounts & cloud sync

## License

MIT

---

Built with ❤️ overnight by Clawd
