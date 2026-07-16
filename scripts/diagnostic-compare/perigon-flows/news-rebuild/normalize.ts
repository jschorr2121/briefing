// Vendored from src/lib/news/normalize.ts (commit 8afca519)
import { createHash } from 'crypto';

export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shortHash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

export function topicCacheKey(rawTopic: string): string {
  return `news:v1:${shortHash(normalizeTopic(rawTopic))}`;
}

export function topicLockKey(rawTopic: string): string {
  return `news:lock:${shortHash(normalizeTopic(rawTopic))}`;
}

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.hash = '';
    const drop: string[] = [];
    u.searchParams.forEach((_v, k) => {
      if (k.startsWith('utm_') || k === 'fbclid' || k === 'gclid' || k === 'mc_eid' || k === 'ref' || k === 'ref_src') {
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

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
