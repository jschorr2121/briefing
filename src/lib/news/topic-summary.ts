// Generates the per-topic bulleted summary that sits above the card stack.
//
// Constraints (encoded in the prompt):
//   - Output is bullets only, no preamble or closing.
//   - Every card must be touched on in the bullets.
//   - Every bullet must correspond to one of the cards (no fabricated facts).
//   - Bullets ordered by importance (matches the card order from the rank step).
//   - Default mapping: one bullet per card. The model may merge two cards into
//     one bullet only when they cover overlapping ground.

import { getOpenAIModel } from '../models';
import type { NewsCard } from './rank';
import { log, logJson } from './logger';

const SUMMARY_SYSTEM_PROMPT = `You write the bulleted summary that sits above a stack of news story cards in a personalized news briefing.

You will be given a JSON array of N story cards (typically 3-6) for a single topic. Each card has a title and a short summary.

OUTPUT RULES:
1. Output ONLY markdown bullet points starting with "- ". No preamble. No closing line. No headers. No emojis.
2. EVERY card must be represented in the bullets — no orphan cards.
3. EVERY bullet must correspond to one of the provided cards — do NOT fabricate facts or cite information not present in the cards.
4. Default to one bullet per card, in the same order they were provided. You may MERGE two cards into a single bullet ONLY when they cover the same underlying event (avoid duplicate bullets in that case).
5. Each bullet should be one tight sentence (15-30 words). Concrete and informative — name the actor, the action, and why it matters.
6. Write in a calm, neutral, professional voice. No hype words. No first-person. No "Read more".

If you receive an empty array, output nothing.`;

interface CardForPrompt {
  index: number;
  title: string;
  summary: string;
}

function cardsForPrompt(cards: NewsCard[]): CardForPrompt[] {
  return cards.map((c, i) => ({
    index: i + 1,
    title: c.title,
    summary: c.summary || '',
  }));
}

/**
 * Calls the OpenAI Responses API (chat-completions) to generate the bulleted
 * summary. Returns the markdown string. On failure, falls back to a simple
 * "title — summary" rendering of the cards so the briefing always has content.
 */
export async function generateTopicSummary(opts: {
  topic: string;
  cards: NewsCard[];
}): Promise<string> {
  const { topic, cards } = opts;
  if (cards.length === 0) return '';

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[news/topic-summary] OPENAI_API_KEY not configured, using fallback');
    return fallbackSummary(cards);
  }

  const promptCards = cardsForPrompt(cards);
  logJson('topic-summary', `Input cards for "${topic}"`, promptCards);
  const userMessage = `Topic: ${topic}\n\nCards:\n${JSON.stringify(promptCards, null, 2)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getOpenAIModel(),
        messages: [
          { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI summary call failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    if (data.usage) {
      log('topic-summary', `tokens — in: ${data.usage.prompt_tokens}, out: ${data.usage.completion_tokens}`);
    }
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new Error('Empty summary from OpenAI');
    log('topic-summary', `Generated summary for "${topic}" (${text.length} chars)`);
    return text;
  } catch (err) {
    console.error('[news/topic-summary] LLM failed, using fallback:', err);
    return fallbackSummary(cards);
  }
}

function fallbackSummary(cards: NewsCard[]): string {
  return cards
    .map((c) => {
      const trimmed = (c.summary || '').replace(/\s+/g, ' ').trim();
      const oneLine = trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
      return `- ${c.title}${oneLine ? ` — ${oneLine}` : ''}`;
    })
    .join('\n');
}
