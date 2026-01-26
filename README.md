# Briefing 📰

**Your Personal News Intelligence**

A sleek, dark-themed web app that generates AI-powered news briefings based on your interests. Built with Next.js 14, TypeScript, and Tailwind CSS.

## ✨ Features

### Core
- 🔍 **OpenAI Web Search** - Real-time news via OpenAI's web search API
- 📰 **Story Cards** - Scrollable cards with headlines and bullet points
- 🎯 **Topic Selection** - Choose from presets or add custom topics
- 💾 **Persistent State** - Preferences saved locally
- 📤 **Export to Markdown** - Download briefings for later

### Audio
- 🎧 **Text-to-Speech** - Listen to your briefing using OpenAI TTS
- 🎙️ **Voice Selection** - 6 voices: Nova, Alloy, Echo, Fable, Onyx, Shimmer
- ⏩ **Playback Speed** - 0.75x to 2x speed control

### UI/UX
- 🌙 **Dark Theme** - Modern indigo/purple gradient design
- 📱 **Mobile Responsive** - Optimized for all screen sizes
- ⌨️ **Keyboard Shortcuts** - ⌘G to generate, ⌘, for settings
- ♿ **Accessible** - ARIA labels and keyboard navigation

## Topics

Built-in topics:
- 🤖 AI & Tech
- 📈 Finance
- 🌍 World News
- 🏀 Sports
- 🔬 Science
- 🚀 Startups
- 🏈 NY Jets

Plus, add your own custom topics!

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- OpenAI API key (required for web search & TTS)

### Installation

```bash
# Clone the repo
cd briefing

# Install dependencies
pnpm install

# Create environment file
cat > .env.local << EOF
OPENAI_API_KEY=your_openai_key
BRAVE_API_KEY=your_brave_key  # Optional fallback
ANTHROPIC_API_KEY=your_anthropic_key  # Optional fallback
EOF

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
| `OPENAI_API_KEY` | OpenAI API key for web search & TTS | Yes |
| `BRAVE_API_KEY` | Brave Search API key (fallback) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback summaries) | No |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **AI**: OpenAI (web search, TTS), Anthropic (fallback)

## Project Structure

```
briefing/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/   # News generation API
│   │   │   ├── audio/      # TTS API
│   │   │   └── email/      # Email delivery API
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Main page
│   ├── components/
│   │   ├── BriefingCard.tsx     # Story cards + scroll
│   │   ├── BriefingStats.tsx    # Stats display
│   │   ├── GenerateButton.tsx
│   │   ├── Header.tsx
│   │   ├── HistoryPanel.tsx
│   │   ├── KeyboardHints.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── AddTopicModal.tsx
│   │   └── TopicSelector.tsx
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   └── lib/
│       ├── types.ts        # TypeScript types
│       └── utils.ts        # Utility functions
├── .env.local              # Environment variables
├── package.json
└── README.md
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + G` | Generate briefing |
| `⌘/Ctrl + ,` | Open settings |
| `⌘/Ctrl + E` | Export to markdown |
| `←` `→` | Navigate story cards |
| `Esc` | Close modals |

## Recent Updates

### v0.2.0 (Jan 2026)
- ✅ OpenAI Web Search integration
- ✅ Scrollable story cards with bullets
- ✅ Voice selection for TTS (6 voices)
- ✅ Playback speed control (0.75x-2x)
- ✅ Improved color scheme (indigo/purple)
- ✅ Mobile responsiveness
- ✅ Accessibility improvements

### v0.1.0
- Initial release with Brave Search
- Basic briefing generation

## License

MIT

---

Built with ❤️ by Clawd
