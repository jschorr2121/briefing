// Offline sanity check for the search-api fetcher's parsing and result
// preparation. No network, no keys. Run with: npx tsx scripts/check-search-fetcher.ts

import { parsePlannedQueries, prepareSearchResults, normalizeDate } from '../src/lib/search-fetcher';

let failures = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}`);
    failures++;
  }
}

// ─── parsePlannedQueries ─────────────────────────────────────────────

check('parses plain JSON', JSON.stringify(parsePlannedQueries('{"queries":["a","b"]}', 't')) === '["a","b"]');
check('parses fenced JSON', parsePlannedQueries('```json\n{"queries":["x"]}\n```', 't')[0] === 'x');
check('falls back to topic on garbage', parsePlannedQueries('no json', 'my topic')[0] === 'my topic');
check('falls back to topic on empty list', parsePlannedQueries('{"queries":[]}', 'my topic')[0] === 'my topic');
check('caps at 3 queries', parsePlannedQueries('{"queries":["a","b","c","d","e"]}', 't').length === 3);
check('drops non-string entries', JSON.stringify(parsePlannedQueries('{"queries":["a", 42, ""]}', 't')) === '["a"]');

// ─── normalizeDate ───────────────────────────────────────────────────

const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
check('relative "2 days ago" becomes a real date', normalizeDate('2 days ago').includes(String(twoDaysAgo.getFullYear())));
check('absolute dates reformatted', normalizeDate('2026-07-16T10:00:00Z').startsWith('Jul 16'));
check('unparseable strings pass through', normalizeDate('sometime') === 'sometime');
check('empty stays empty', normalizeDate(undefined) === '');

// ─── prepareSearchResults ────────────────────────────────────────────

const raw = [
  { title: 'Story A', url: 'https://site.com/a-article', source: 'site.com', date: '1 day ago', snippet: 'x'.repeat(1000) },
  { title: 'Story A dup url', url: 'https://site.com/a-article?utm_source=feed', snippet: 'dup by url after query-strip' },
  { title: 'Story A', url: 'https://other.com/same-title', snippet: 'dup by title' },
  { title: 'Landing page', url: 'https://news.example.com/', snippet: 'root URL, not a permalink' },
  { title: 'No url' },
  { title: 'Bad url', url: 'notaurl' },
  { title: 'Ancient', url: 'https://site.com/old', date: 'Jan 1, 2020', snippet: 'stale' },
  { title: 'Story B', url: 'https://b.com/b-article', date: '2026-07-15', snippet: 'fine' },
];
const prepared = prepareSearchResults(raw);

check('keeps only valid, fresh, distinct results', prepared.length === 2);
check('dedupes by URL ignoring query string', !prepared.some(a => a.url.includes('utm_source')));
check('dedupes by title across hosts', !prepared.some(a => a.url === 'https://other.com/same-title'));
check('drops root/landing URLs', !prepared.some(a => a.url === 'https://news.example.com/'));
check('drops stale results', !prepared.some(a => a.title === 'Ancient'));
check('caps snippet length (context control)', prepared[0].summary.length <= 400);
check('derives source from host when missing', prepared[1].source === 'b.com');
check('relative age became absolute date', prepared[0].date.includes('2026'));

const many = Array.from({ length: 30 }, (_, i) => ({
  title: `Story ${i}`,
  url: `https://site${i}.com/article-${i}`,
  snippet: 's',
}));
check('caps at 12 articles', prepareSearchResults(many).length === 12);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
