// Pure normalization helpers for the news pipeline.
// No I/O. No dependencies on other news/* modules.

import { createHash } from 'crypto';

/**
 * Normalize a free-text topic into a stable, lowercased canonical form.
 * Used as the basis for the topic-level cache key — two phrasings that
 * produce the same normalized string will hit the same cache entry.
 *
 *   "  AI  " → "ai"
 *   "A.I."   → "ai"
 *   "AI!!!"  → "ai"
 */
export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip combining marks
    .replace(/[^a-z0-9\s]/g, ' ')      // strip punctuation
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim();
}

/**
 * SHA1 hash, hex, truncated to 16 chars. Plenty of entropy for a cache key
 * and keeps Redis keys short.
 */
export function shortHash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

/** Redis key for the topic-level result cache. */
export function topicCacheKey(rawTopic: string): string {
  return `news:v1:${shortHash(normalizeTopic(rawTopic))}`;
}

/** Redis key for the per-topic in-flight lock. */
export function topicLockKey(rawTopic: string): string {
  return `news:lock:${shortHash(normalizeTopic(rawTopic))}`;
}

/**
 * Canonicalize an article URL for dedup:
 *   - lowercase the host
 *   - drop tracking params (utm_*, fbclid, gclid, mc_eid, ref, ref_src)
 *   - drop trailing slash
 *   - drop fragment
 *
 * Returns the original string if parsing fails.
 */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.hash = '';
    const drop: string[] = [];
    u.searchParams.forEach((_v, k) => {
      if (
        k.startsWith('utm_') ||
        k === 'fbclid' ||
        k === 'gclid' ||
        k === 'mc_eid' ||
        k === 'ref' ||
        k === 'ref_src'
      ) {
        drop.push(k);
      }
    });
    for (const k of drop) u.searchParams.delete(k);
    let out = u.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return raw;
  }
}

/** Extract a lowercased host for source diversification. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** ISO date string for `from=now-Nd` style params. */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
