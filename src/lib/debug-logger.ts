/**
 * Debug logger for briefing generation pipeline.
 * Creates timestamped log files in /logs with full details:
 * query plans, API params, search results, LLM inputs/outputs.
 *
 * Only active when NEXT_PUBLIC_DEV_MODE=true.
 */

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { PerigonArticle } from './perigon';
import type { PreparedArticle } from './prompts';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

// ─── Per-generation session ──────────────────────────────────────────

interface LogEntry {
  timestamp: string;
  event: string;
  data: unknown;
}

let sessionEntries: LogEntry[] = [];
let sessionId = '';

export function startSession(): string {
  const now = new Date();
  sessionId = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  sessionEntries = [];
  log('session_start', { timestamp: now.toISOString() });
  return sessionId;
}

export function log(event: string, data: unknown): void {
  if (!IS_DEV) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    event,
    data,
  };
  sessionEntries.push(entry);

  // Also console log with structured format
  const prefix = eventPrefix(event);
  if (typeof data === 'object' && data !== null) {
    console.log(`${prefix} ${event}:`, JSON.stringify(data, null, 0).slice(0, 500));
  } else {
    console.log(`${prefix} ${event}:`, data);
  }
}

function eventPrefix(event: string): string {
  if (event.startsWith('query_plan')) return '📋';
  if (event.startsWith('api_call')) return '🌐';
  if (event.startsWith('api_result')) return '📄';
  if (event.startsWith('cascade')) return '🔽';
  if (event.startsWith('stories')) return '📰';
  if (event.startsWith('llm')) return '🤖';
  if (event.startsWith('filter')) return '🔍';
  if (event.startsWith('cache')) return '📦';
  return '📝';
}

/** Summarize a Perigon article for logging (omit content/description noise) */
function summarizeArticle(a: PerigonArticle): object {
  return {
    title: a.title,
    source: a.source?.name || a.source?.domain,
    pubDate: a.pubDate,
    url: a.url,
    labels: a.labels?.map(l => l.name),
    categories: a.categories?.map(c => c.name),
    topics: a.topics?.map(t => t.name),
  };
}

// ─── Typed log helpers ───────────────────────────────────────────────

export function logQueryPlan(topicName: string, queries: { type: string; query: string; vectorQuery?: string; perigonCategory?: string; perigonTopic?: string; companyName?: string; useStories?: boolean }[]): void {
  log('query_plan', {
    topic: topicName,
    queries: queries.map(q => ({
      type: q.type,
      query: q.query,
      vectorQuery: q.vectorQuery,
      perigonCategory: q.perigonCategory,
      perigonTopic: q.perigonTopic,
      companyName: q.companyName,
      useStories: q.useStories,
    })),
  });
}

export function logApiCall(endpoint: string, params: Record<string, unknown>): void {
  // Strip apiKey from logged params
  const clean = { ...params };
  delete clean.apiKey;
  log('api_call', { endpoint, params: clean });
}

export function logApiResult(endpoint: string, query: string, articles: PerigonArticle[], cascadeStep?: string): void {
  log('api_result', {
    endpoint,
    query,
    cascadeStep,
    totalResults: articles.length,
    articles: articles.slice(0, 20).map(summarizeArticle),
  });
}

export function logStoriesResult(query: string, stories: { title: string; uniqueSources: number; articleCount: number }[]): void {
  log('api_result_stories', {
    query,
    storyCount: stories.length,
    stories,
  });
}

export function logVectorFilter(before: number, after: number, removed: { title: string; reason: string }[]): void {
  log('filter_vector', { before, after, removed });
}

export function logLLMInput(topicName: string, articles: PreparedArticle[]): void {
  log('llm_input', {
    topic: topicName,
    articleCount: articles.length,
    articles: articles.map(a => ({
      title: a.title,
      source: a.source,
      date: a.date,
      url: a.url,
      summaryPreview: a.summary?.slice(0, 100),
    })),
  });
}

export function logLLMOutput(topicName: string, summary: string, stories: { headline: string; date?: string; source?: string }[]): void {
  log('llm_output', {
    topic: topicName,
    summary,
    storyCount: stories.length,
    stories,
  });
}

// ─── Flush to file ──────────────────────────────────────────────────

export async function flushSession(): Promise<string | null> {
  if (!IS_DEV || sessionEntries.length === 0) return null;

  try {
    await mkdir(LOGS_DIR, { recursive: true });
    const filename = `briefing-${sessionId}.json`;
    const filepath = path.join(LOGS_DIR, filename);

    const output = {
      sessionId,
      generatedAt: new Date().toISOString(),
      entryCount: sessionEntries.length,
      entries: sessionEntries,
    };

    await writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`📝 Debug log written: logs/${filename}`);
    return filepath;
  } catch (err) {
    console.error('Failed to write debug log:', err);
    return null;
  }
}
