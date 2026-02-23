import { getOpenAIModel } from './models';
import { searchArticles } from './perigon';

// ─── Types ───────────────────────────────────────────────────────────

export interface TopicConfig {
  id: string;
  displayName: string;
  type: 'broad' | 'niche';
  queryStrategy: 'stories' | 'vector';
  keywordQuery: string;
  vectorPrompt?: string;
  /** Perigon taxonomy tag for the `topic` API param (e.g. "AI", "NFL") */
  perigonTopic?: string;
  /** Perigon category for the `category` API param (e.g. "Tech", "Sports") */
  perigonCategory?: string;
  /** UI grouping category */
  category?: string;
}

// ─── Curated Topics ──────────────────────────────────────────────────

const CURATED_TOPICS = new Map<string, TopicConfig>([
  // ── Technology ────────────────────────────────────────────────────
  // Perigon tags verified: AI ✓, Cryptocurrency ✓, Gaming ✓
  ['artificial_intelligence', {
    id: 'artificial_intelligence', displayName: 'Artificial Intelligence',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'artificial intelligence AI',
    perigonTopic: 'AI', perigonCategory: 'Tech', category: 'Technology',
  }],
  ['cybersecurity', {
    id: 'cybersecurity', displayName: 'Cybersecurity',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'cybersecurity data breach hacking',
    vectorPrompt: 'cybersecurity news, data breaches, ransomware attacks, zero-day vulnerabilities, and information security threats',
    category: 'Technology',
  }],
  ['cloud_computing', {
    id: 'cloud_computing', displayName: 'Cloud Computing',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'cloud computing AWS Azure Google Cloud',
    vectorPrompt: 'cloud computing infrastructure, AWS, Azure, Google Cloud Platform, serverless, Kubernetes, cloud migration, and multi-cloud strategy',
    category: 'Technology',
  }],
  ['startups_vc', {
    id: 'startups_vc', displayName: 'Startups & Venture Capital',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'startup funding venture capital',
    vectorPrompt: 'startup funding rounds, venture capital investments, Series A B C, unicorns, Y Combinator, and tech startup news',
    category: 'Technology',
  }],
  ['cryptocurrency', {
    id: 'cryptocurrency', displayName: 'Cryptocurrency',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'cryptocurrency bitcoin ethereum',
    perigonTopic: 'Cryptocurrency', perigonCategory: 'Tech', category: 'Technology',
  }],
  ['software_engineering', {
    id: 'software_engineering', displayName: 'Software Engineering',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'software engineering programming developer tools',
    vectorPrompt: 'software engineering trends, programming languages, developer tools, open source projects, DevOps, and software architecture',
    category: 'Technology',
  }],
  ['consumer_tech', {
    id: 'consumer_tech', displayName: 'Consumer Tech',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'consumer technology gadgets',
    vectorPrompt: 'consumer technology, Apple iPhone, Samsung Galaxy, gadgets, wearables, smart home devices, and product launches',
    perigonCategory: 'Tech', category: 'Technology',
  }],
  ['semiconductors', {
    id: 'semiconductors', displayName: 'Semiconductors',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'semiconductor chip manufacturing',
    vectorPrompt: 'semiconductor chip manufacturing, TSMC, Intel, NVIDIA supply chain, fab capacity, and export controls',
    category: 'Technology',
  }],

  // ── Business & Finance ────────────────────────────────────────────
  // Perigon tags verified: Economy ✓, Real Estate ✓
  ['stock_market', {
    id: 'stock_market', displayName: 'Stock Market',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'stock market Wall Street S&P 500',
    vectorPrompt: 'stock market news, S&P 500, Dow Jones, NASDAQ, Wall Street trading, earnings reports, and market analysis',
    perigonCategory: 'Finance', category: 'Business & Finance',
  }],
  ['financial_services', {
    id: 'financial_services', displayName: 'Financial Services',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'financial services fintech banking',
    vectorPrompt: 'financial services industry, fintech innovation, payment processing, digital banking, insurance technology, and wealth management',
    category: 'Business & Finance',
  }],
  ['real_estate', {
    id: 'real_estate', displayName: 'Real Estate',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'real estate housing market mortgage',
    perigonTopic: 'Real Estate', perigonCategory: 'Finance', category: 'Business & Finance',
  }],
  ['economy', {
    id: 'economy', displayName: 'Economy',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'economy GDP inflation Federal Reserve',
    perigonTopic: 'Economy', perigonCategory: 'Finance', category: 'Business & Finance',
  }],
  ['banking', {
    id: 'banking', displayName: 'Banking',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'banking banks financial regulation',
    vectorPrompt: 'banking industry, bank regulations, interest rates, Federal Reserve policy, commercial banking, and financial institution news',
    perigonCategory: 'Finance', category: 'Business & Finance',
  }],
  ['mergers_acquisitions', {
    id: 'mergers_acquisitions', displayName: 'Mergers & Acquisitions',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'mergers acquisitions M&A deals',
    vectorPrompt: 'mergers and acquisitions, corporate buyouts, IPOs, SPACs, private equity deals, and antitrust reviews',
    category: 'Business & Finance',
  }],

  // ── Sports ────────────────────────────────────────────────────────
  // Perigon tags verified: NFL ✓, NBA ✓, MLB ✓, UFC ✓, Tennis ✓, Golf ✓, Soccer ✓, Formula 1 ✓
  ['nfl', {
    id: 'nfl', displayName: 'NFL',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'NFL football',
    perigonTopic: 'NFL', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['nba', {
    id: 'nba', displayName: 'NBA',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'NBA basketball',
    perigonTopic: 'NBA', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['pga_tour', {
    id: 'pga_tour', displayName: 'PGA Tour',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'PGA Tour golf tournament',
    vectorPrompt: 'PGA Tour golf tournaments, player rankings, major championships, LIV Golf, course results, and professional golf news',
    category: 'Sports',
  }],
  ['ufc_mma', {
    id: 'ufc_mma', displayName: 'UFC/MMA',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'UFC MMA mixed martial arts',
    perigonTopic: 'UFC', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['formula_1', {
    id: 'formula_1', displayName: 'Formula 1',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'Formula 1 F1 Grand Prix racing',
    perigonTopic: 'Formula 1', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['college_football', {
    id: 'college_football', displayName: 'College Football',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'college football NCAA CFP',
    vectorPrompt: 'college football, NCAA, College Football Playoff, bowl games, recruiting, and conference realignment news',
    perigonCategory: 'Sports', category: 'Sports',
  }],
  ['premier_league', {
    id: 'premier_league', displayName: 'Premier League Soccer',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'Premier League soccer football EPL',
    perigonTopic: 'Soccer', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['mlb', {
    id: 'mlb', displayName: 'MLB',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'MLB baseball',
    perigonTopic: 'MLB', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['tennis', {
    id: 'tennis', displayName: 'Tennis',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'tennis ATP WTA Grand Slam',
    perigonTopic: 'Tennis', perigonCategory: 'Sports', category: 'Sports',
  }],
  ['golf', {
    id: 'golf', displayName: 'Golf',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'golf PGA LPGA major championship',
    perigonTopic: 'Golf', perigonCategory: 'Sports', category: 'Sports',
  }],

  // ── Science ───────────────────────────────────────────────────────
  // Perigon tags verified: Space ✓, NASA ✓, Climate Change ✓
  ['space_astronomy', {
    id: 'space_astronomy', displayName: 'Space & Astronomy',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'space NASA astronomy SpaceX',
    perigonTopic: 'Space', perigonCategory: 'Science', category: 'Science',
  }],
  ['climate_environment', {
    id: 'climate_environment', displayName: 'Climate & Environment',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'climate change environment sustainability',
    perigonTopic: 'Climate Change', perigonCategory: 'Science', category: 'Science',
  }],
  ['biotech_pharma', {
    id: 'biotech_pharma', displayName: 'Biotech & Pharma',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'biotech pharmaceutical drug development',
    vectorPrompt: 'biotechnology, pharmaceutical drug development, FDA approvals, clinical trials, gene therapy, and biotech company news',
    category: 'Science',
  }],
  ['physics_energy', {
    id: 'physics_energy', displayName: 'Physics & Energy',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'physics energy nuclear fusion',
    vectorPrompt: 'physics breakthroughs, energy technology, nuclear fusion, renewable energy research, quantum computing, and particle physics',
    category: 'Science',
  }],

  // ── Politics & World ──────────────────────────────────────────────
  ['us_politics', {
    id: 'us_politics', displayName: 'US Politics',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'US politics Congress White House',
    vectorPrompt: 'US politics, Congress, White House, legislation, presidential administration, political campaigns, and policy debates',
    perigonCategory: 'Politics', category: 'Politics & World',
  }],
  ['world_news', {
    id: 'world_news', displayName: 'World News',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'world news international',
    vectorPrompt: 'world news, international affairs, global events, United Nations, diplomacy, and breaking international news',
    perigonCategory: 'Politics', category: 'Politics & World',
  }],
  ['supreme_court', {
    id: 'supreme_court', displayName: 'Supreme Court',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'Supreme Court SCOTUS ruling',
    vectorPrompt: 'US Supreme Court decisions, SCOTUS rulings, constitutional law cases, judicial nominations, and landmark court opinions',
    category: 'Politics & World',
  }],
  ['geopolitics', {
    id: 'geopolitics', displayName: 'Geopolitics',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'geopolitics international relations diplomacy',
    vectorPrompt: 'geopolitics, international relations, trade wars, sanctions, NATO, China-US relations, and global power dynamics',
    category: 'Politics & World',
  }],
  ['defense_military', {
    id: 'defense_military', displayName: 'Defense & Military',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'defense military Pentagon',
    vectorPrompt: 'military defense spending, Pentagon contracts, weapons systems, NATO operations, and armed forces deployments',
    category: 'Politics & World',
  }],

  // ── Lifestyle ─────────────────────────────────────────────────────
  // Perigon tags verified: Fitness ✓, Parenting ✓
  ['travel', {
    id: 'travel', displayName: 'Travel',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'travel tourism airlines destinations',
    vectorPrompt: 'travel news, airlines, hotel industry, travel destinations, tourism trends, and vacation planning',
    perigonCategory: 'Lifestyle', category: 'Lifestyle',
  }],
  ['food_dining', {
    id: 'food_dining', displayName: 'Food & Dining',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'food dining restaurants',
    vectorPrompt: 'restaurant openings, food trends, chef news, dining reviews, culinary innovation, and food industry developments',
    category: 'Lifestyle',
  }],
  ['personal_finance', {
    id: 'personal_finance', displayName: 'Personal Finance',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'personal finance investing savings retirement',
    vectorPrompt: 'personal finance tips, investing strategies, retirement planning, savings advice, credit cards, and budgeting',
    perigonCategory: 'Finance', category: 'Lifestyle',
  }],
  ['health_fitness', {
    id: 'health_fitness', displayName: 'Health & Fitness',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'health fitness wellness',
    perigonTopic: 'Fitness', perigonCategory: 'Lifestyle', category: 'Lifestyle',
  }],
  ['parenting', {
    id: 'parenting', displayName: 'Parenting',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'parenting children family',
    perigonTopic: 'Parenting', perigonCategory: 'Lifestyle', category: 'Lifestyle',
  }],

  // ── Entertainment ─────────────────────────────────────────────────
  // Perigon tags verified: Movies ✓, Music ✓, Gaming ✓
  ['movies_tv', {
    id: 'movies_tv', displayName: 'Movies & TV',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'movies TV shows entertainment',
    perigonTopic: 'Movies', perigonCategory: 'Entertainment', category: 'Entertainment',
  }],
  ['music', {
    id: 'music', displayName: 'Music',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'music albums concerts artists',
    perigonTopic: 'Music', perigonCategory: 'Entertainment', category: 'Entertainment',
  }],
  ['gaming', {
    id: 'gaming', displayName: 'Gaming',
    type: 'broad', queryStrategy: 'stories', keywordQuery: 'video games gaming',
    perigonTopic: 'Gaming', perigonCategory: 'Entertainment', category: 'Entertainment',
  }],
  ['streaming', {
    id: 'streaming', displayName: 'Streaming',
    type: 'niche', queryStrategy: 'vector', keywordQuery: 'streaming Netflix Disney+ HBO',
    vectorPrompt: 'streaming wars, Netflix, Disney+, HBO Max, Apple TV+, subscriber growth, content deals, and streaming industry trends',
    category: 'Entertainment',
  }],
]);

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Look up a topic config by ID. Returns null if not found. */
export function getTopicConfig(topicId: string): TopicConfig | null {
  return CURATED_TOPICS.get(topicId) ?? null;
}

/** Try to match a user's display name to a curated topic (case-insensitive). */
export function findCuratedTopic(displayName: string): TopicConfig | null {
  const lower = displayName.toLowerCase().trim();
  const all = Array.from(CURATED_TOPICS.values());
  for (const config of all) {
    if (config.displayName.toLowerCase() === lower) return config;
  }
  // Partial / alias matching for common short names
  for (const config of all) {
    const dl = config.displayName.toLowerCase();
    if (dl.includes(lower) || lower.includes(dl)) return config;
  }
  return null;
}

/** Get all curated topics organized by category for a browse UI. */
export function getCuratedTopicsByCategory(): Record<string, TopicConfig[]> {
  const result: Record<string, TopicConfig[]> = {};
  for (const config of Array.from(CURATED_TOPICS.values())) {
    const cat = config.category ?? 'Other';
    if (!result[cat]) result[cat] = [];
    result[cat].push(config);
  }
  return result;
}

// ─── Resolve frontend Topic → TopicConfig ────────────────────────────

/**
 * Convert a frontend Topic (name) to a TopicConfig for querying.
 * First tries findCuratedTopic by name, then falls back to a basic vector config.
 */
export function resolveTopicToConfig(topic: { name: string }): TopicConfig {
  const curated = findCuratedTopic(topic.name);
  if (curated) return curated;

  // Fallback: treat as niche / vector search
  const id = topic.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return {
    id,
    displayName: topic.name,
    type: 'niche',
    queryStrategy: 'vector',
    keywordQuery: topic.name,
    vectorPrompt: topic.name,
  };
}

// ─── Create custom topic config via LLM ──────────────────────────────

/**
 * Generate a TopicConfig for an arbitrary user-entered topic using GPT-5-nano.
 * 1. Calls GPT-5-nano to generate a TopicConfig JSON
 * 2. Tests the config by running a quick Perigon stories search
 * 3. If stories search returns < 3 results, switches queryStrategy to "vector"
 * 4. Returns the finalized config
 */
export async function createCustomTopicConfig(userInput: string): Promise<TopicConfig> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const model = getOpenAIModel();

  const prompt = `Generate a JSON object for a news topic configuration. The user wants news about: "${userInput}"

Return ONLY valid JSON (no markdown, no code blocks) with these fields:
{
  "id": "snake_case_id",
  "displayName": "Human Readable Name",
  "type": "broad" or "niche",
  "queryStrategy": "stories" or "vector",
  "keywordQuery": "search keywords for news API",
  "vectorPrompt": "descriptive sentence for semantic search (include key entities, companies, people, subtopics)",
}

Choose "broad" + "stories" for well-covered mainstream topics.
Choose "niche" + "vector" for specialized or obscure topics.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const outputText: string = data.choices?.[0]?.message?.content ?? '';

  let config: TopicConfig;
  try {
    const cleaned = outputText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    config = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
  } catch {
    // Fallback: create a basic config from user input
    const id = userInput
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    config = {
      id,
      displayName: userInput,
      type: 'niche',
      queryStrategy: 'vector',
      keywordQuery: userInput,
      vectorPrompt: userInput,
    };
  }

  // Validate the config by testing article search
  if (config.queryStrategy === 'stories') {
    try {
      const testResult = await searchArticles({
        q: config.keywordQuery,
        size: 3,
      });
      if (testResult.numResults < 3) {
        console.log(`⚡ Topic "${config.displayName}" got ${testResult.numResults} articles — switching to vector search`);
        config.queryStrategy = 'vector';
        config.type = 'niche';
        if (!config.vectorPrompt) {
          config.vectorPrompt = config.keywordQuery;
        }
      }
    } catch (err) {
      console.warn(`⚠️ Article search test failed for "${config.displayName}", falling back to vector:`, err);
      config.queryStrategy = 'vector';
      config.type = 'niche';
      if (!config.vectorPrompt) {
        config.vectorPrompt = config.keywordQuery;
      }
    }
  }

  return config;
}
