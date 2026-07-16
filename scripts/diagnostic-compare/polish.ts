import type { StoryCard } from './types.js';

interface RawResult {
  title?: string;
  url?: string;
  source?: string;
  date?: string;
  pubDate?: string;
  description?: string;
  summary?: string;
  snippet?: string;
  content?: string;
  // Brave
  age?: string;
  meta_url?: { netloc?: string };
  // Perigon
  source_domain?: string;
}

export function normalizeRaw(raw: RawResult): { title: string; snippet: string; source: string; date: string; url: string } {
  const title = raw.title || 'Untitled';
  const snippet = raw.summary || raw.description || raw.snippet || raw.content?.slice(0, 300) || '';
  const source =
    raw.source ||
    raw.meta_url?.netloc ||
    raw.source_domain ||
    (raw.url ? new URL(raw.url).hostname.replace(/^www\./, '') : 'Unknown');
  const date = raw.date || raw.pubDate || raw.age || new Date().toISOString().split('T')[0];
  const url = raw.url || '';
  return { title, snippet, source, date, url };
}

export async function polishToCards(
  rawResults: RawResult[],
  topic: string,
  dryRun = false
): Promise<{ cards: StoryCard[]; cost_usd: number }> {
  const normalized = rawResults.map(normalizeRaw).slice(0, 20);

  if (dryRun) {
    return {
      cards: normalized.slice(0, 5).map((r) => ({
        headline: r.title,
        bullets: [r.snippet.slice(0, 100) || 'No snippet available'],
        source: r.source,
        date: r.date,
        url: r.url,
      })),
      cost_usd: 0,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      cards: normalized.slice(0, 5).map((r) => ({
        headline: r.title,
        bullets: [r.snippet.slice(0, 150)].filter(Boolean),
        source: r.source,
        date: r.date,
        url: r.url,
      })),
      cost_usd: 0,
    };
  }

  const inputText = JSON.stringify(normalized);
  const prompt = `You are polishing raw news search results into exactly 5 story cards for a briefing on "${topic}".

Raw results (title, snippet, source, date, url):
${inputText}

Output exactly this JSON array (5 elements, no prose, no markdown):
[
  { "headline": "≤15 words, specific", "bullets": ["concrete fact", "concrete fact"], "source": "Publication Name", "date": "YYYY-MM-DD", "url": "https://..." }
]

Pick the 5 most relevant and recent results. Use concrete facts in bullets. Prefer recent sources.`;

  const start = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    return {
      cards: normalized.slice(0, 5).map((r) => ({
        headline: r.title,
        bullets: [r.snippet.slice(0, 150)].filter(Boolean),
        source: r.source,
        date: r.date,
        url: r.url,
      })),
      cost_usd: 0,
    };
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? '[]';
  const usage = data.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const cost = inputTokens * 0.15 / 1_000_000 + outputTokens * 0.6 / 1_000_000;

  let cards: StoryCard[] = [];
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.stories || parsed.cards || Object.values(parsed)[0] || [];
    cards = arr.slice(0, 5).map((c: Partial<StoryCard>) => ({
      headline: c.headline || 'Untitled',
      bullets: c.bullets || [],
      source: c.source || 'Unknown',
      date: c.date || new Date().toISOString().split('T')[0],
      url: c.url || '',
    }));
  } catch {
    cards = normalized.slice(0, 5).map((r) => ({
      headline: r.title,
      bullets: [r.snippet.slice(0, 150)].filter(Boolean),
      source: r.source,
      date: r.date,
      url: r.url,
    }));
  }

  return { cards, cost_usd: cost };
}
