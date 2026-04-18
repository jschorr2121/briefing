/**
 * Mock API responses — shapes mirror the real API exactly.
 * Use these with page.route() to intercept requests in tests.
 */

// ─── /api/generate ────────────────────────────────────────────────────────────

export const mockGenerateResponse = {
  briefings: [
    {
      topic: 'Artificial Intelligence',
      emoji: '🤖',
      summary:
        'AI development accelerated this week with major releases from leading labs. Researchers pushed the frontier on reasoning, multimodal capabilities, and autonomous agents.',
      stories: [
        {
          headline: 'OpenAI Releases Next-Generation Reasoning Model',
          bullets: [
            'New model achieves state-of-the-art results on math and coding benchmarks',
            'API access rolled out to developers on the paid tier',
            'Context window expanded to 256k tokens',
          ],
          source: 'techcrunch.com',
          url: 'https://techcrunch.com/2026/03/24/openai-reasoning-model',
          date: '2026-03-24',
        },
        {
          headline: 'Google DeepMind Publishes Landmark AI Safety Research',
          bullets: [
            'Paper introduces a new framework for detecting reward hacking',
            'Tested on 12 frontier models with promising early results',
            'Open-sourced evaluation suite available on GitHub',
          ],
          source: 'deepmind.google',
          url: 'https://deepmind.google/research/ai-safety-2026',
          date: '2026-03-23',
        },
      ],
      articles: [
        {
          title: 'OpenAI Releases Next-Generation Reasoning Model',
          source: 'techcrunch.com',
          url: 'https://techcrunch.com/2026/03/24/openai-reasoning-model',
          snippet: 'OpenAI today announced a new reasoning model that sets records on...',
        },
        {
          title: 'Google DeepMind Publishes Landmark AI Safety Research',
          source: 'deepmind.google',
          url: 'https://deepmind.google/research/ai-safety-2026',
          snippet: 'DeepMind researchers have released a new paper on reward hacking detection...',
        },
      ],
      generatedAt: '2026-03-24T12:00:00.000Z',
      model: 'gpt-4o-mini',
    },
    {
      topic: 'World News',
      emoji: '🌍',
      summary:
        'Global headlines this week were dominated by diplomatic developments in Europe and economic shifts across Asia.',
      stories: [
        {
          headline: 'G7 Leaders Convene for Emergency Economic Summit',
          bullets: [
            'Leaders agreed on coordinated response to currency volatility',
            'New trade framework to be finalized by Q3 2026',
            'Climate finance commitments reaffirmed with updated targets',
          ],
          source: 'reuters.com',
          url: 'https://reuters.com/2026/03/24/g7-summit',
          date: '2026-03-24',
        },
      ],
      articles: [
        {
          title: 'G7 Leaders Convene for Emergency Economic Summit',
          source: 'reuters.com',
          url: 'https://reuters.com/2026/03/24/g7-summit',
          snippet: 'G7 finance ministers gathered in Brussels today to discuss...',
        },
      ],
      generatedAt: '2026-03-24T12:00:00.000Z',
      model: 'gpt-4o-mini',
    },
  ],
  model: 'gpt-4o-mini',
};

// ─── /api/subscription ────────────────────────────────────────────────────────

export const mockSubscriptionFree = {
  tier: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  hasStripeCustomer: false,
  topicLimit: 4,
  usage: {
    used: 1,
    limit: 3,
    allowed: true,
  },
};

export const mockSubscriptionPro = {
  tier: 'pro',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-04-24T00:00:00.000Z',
  hasStripeCustomer: true,
  topicLimit: null, // null = unlimited
  usage: {
    used: 5,
    limit: null, // null = unlimited
    allowed: true,
  },
};

export const mockSubscriptionLimitReached = {
  tier: 'free',
  subscriptionStatus: null,
  currentPeriodEnd: null,
  hasStripeCustomer: false,
  topicLimit: 4,
  usage: {
    used: 3,
    limit: 3,
    allowed: false,
  },
};

// ─── /api/generate — 429 limit reached ───────────────────────────────────────

export const mockGenerateLimitReached = {
  error: 'Daily briefing limit reached',
  code: 'LIMIT_REACHED',
  usage: { used: 3, limit: 3, tier: 'free' },
};

// ─── /api/topics ──────────────────────────────────────────────────────────────

export const mockTopicsResponse = {
  categories: {
    Technology: [
      { id: 'artificial_intelligence', displayName: 'Artificial Intelligence', type: 'broad' },
      { id: 'cybersecurity', displayName: 'Cybersecurity', type: 'niche' },
      { id: 'cryptocurrency', displayName: 'Cryptocurrency', type: 'broad' },
    ],
    'Business & Finance': [
      { id: 'stock_market', displayName: 'Stock Market', type: 'niche' },
      { id: 'economy', displayName: 'Economy', type: 'broad' },
    ],
    'World & Politics': [
      { id: 'world_news', displayName: 'World News', type: 'broad' },
      { id: 'us_politics', displayName: 'U.S. Politics', type: 'broad' },
    ],
  },
};

// ─── /api/audio ───────────────────────────────────────────────────────────────
// Returns a binary MP3 blob — tests mock it as a minimal valid response

export const mockAudioBlob = Buffer.from([
  // Minimal MP3 header (ID3v2) — enough for the browser to create an object URL
  0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

// ─── /api/schedules ───────────────────────────────────────────────────────────

export const mockSchedulesResponse = [
  {
    id: 'sched_abc123',
    email: 'test@briefing.dev',
    time: '08:00',
    timezone: 'America/New_York',
    topics: ['Artificial Intelligence', 'World News'],
    enabled: true,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

// ─── /api/stripe/prices ───────────────────────────────────────────────────────
// Shape the pricing page actually expects

export const mockStripePrices = {
  configured: true,
  monthlyPriceId: 'price_monthly_test',
  annualPriceId: 'price_annual_test',
};

// ─── Seed topics for localStorage ────────────────────────────────────────────
// Use this to pre-seed the home page with topics before tests run.

export const seedTopics = [
  { id: 'artificial_intelligence', name: 'Artificial Intelligence', emoji: '🤖', enabled: true },
  { id: 'world_news', name: 'World News', emoji: '🌍', enabled: true },
  { id: 'stock_market', name: 'Stock Market', emoji: '📈', enabled: false },
];
