// Offline sanity check for the search-api fetcher's parsing and result
// preparation. No network, no keys. Run with: npx tsx scripts/check-search-fetcher.ts

import { parsePlannedQueries, prepareSearchResults, normalizeDate, clampQuery, parseKeepIndices } from '../src/lib/search-fetcher';

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

const oneHost = Array.from({ length: 6 }, (_, i) => ({
  title: `Same-host story ${i}`,
  url: `https://onehost.com/article-${i}`,
  snippet: 's',
}));
const capped = prepareSearchResults([...oneHost, { title: 'Other host', url: 'https://elsewhere.com/story', snippet: 's' }]);
check('caps articles per host (source diversity)', capped.filter(a => a.url.includes('onehost.com')).length === 3);
check('host cap leaves room for other hosts', capped.some(a => a.url.includes('elsewhere.com')));

// ─── clampQuery ──────────────────────────────────────────────────────

check('short queries pass through', clampQuery('Fed rates', 100) === 'Fed rates');
const long = 'word '.repeat(30).trim(); // 149 chars
check('long queries clamped under limit', clampQuery(long, 100).length <= 100);
check('clamp cuts at word boundary', !clampQuery(long, 100).endsWith('wor'));
check('unbreakable strings hard-cut', clampQuery('x'.repeat(150), 100).length === 100);

// ─── parseKeepIndices (relevance gate) ───────────────────────────────

check('parses keep list to 0-based indices', JSON.stringify(parseKeepIndices('{"keep":[1,3]}', 5)) === '[0,2]');
check('parses fenced keep list', JSON.stringify(parseKeepIndices('```json\n{"keep":[2]}\n```', 3)) === '[1]');
check('empty keep list means drop all', JSON.stringify(parseKeepIndices('{"keep":[]}', 5)) === '[]');
check('out-of-range and junk entries ignored', JSON.stringify(parseKeepIndices('{"keep":[0,1,99,"x",2.5]}', 5)) === '[0]');
check('dedupes repeated indices', JSON.stringify(parseKeepIndices('{"keep":[2,2,2]}', 5)) === '[1]');
check('garbage returns null (fail open)', parseKeepIndices('not json', 5) === null);
check('missing keep field returns null', parseKeepIndices('{"other":[1]}', 5) === null);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
