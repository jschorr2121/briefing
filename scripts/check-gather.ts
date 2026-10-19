// Offline sanity check for src/lib/gather.ts parsing + result preparation.
// No network, no keys. Run with: npx tsx scripts/check-gather.ts

import { parsePlannedQueries, prepareSearchResults, normalizeDate, parseKeepIndices } from '../src/lib/gather';

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) failures++;
}

check('planner: plain JSON', JSON.stringify(parsePlannedQueries('{"queries":["a","b"]}', 't')) === '["a","b"]');
check('planner: fenced JSON', parsePlannedQueries('```json\n{"queries":["x"]}\n```', 't')[0] === 'x');
check('planner: garbage → topic', parsePlannedQueries('no json', 'my topic')[0] === 'my topic');
check('planner: caps at 3', parsePlannedQueries('{"queries":["a","b","c","d"]}', 't').length === 3);
check('planner: drops non-strings', JSON.stringify(parsePlannedQueries('{"queries":["a", 42, ""]}', 't')) === '["a"]');

const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
check('date: "2 days ago" → real date', normalizeDate('2 days ago').includes(String(twoDaysAgo.getFullYear())));
check('date: ISO reformatted', normalizeDate('2026-07-16T10:00:00Z').startsWith('Jul 16'));
check('date: empty stays empty', normalizeDate(undefined) === '');

check('gate: parses 1-based → 0-based', JSON.stringify(parseKeepIndices('{"keep":[1,3]}', 5)) === '[0,2]');
check('gate: out-of-range dropped', JSON.stringify(parseKeepIndices('{"keep":[0,6,2]}', 5)) === '[1]');
check('gate: unparseable → null (fail open)', parseKeepIndices('nope', 5) === null);

const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
const prepared = prepareSearchResults([
  { title: 'A', url: 'https://x.com/a', date: '1 day ago', snippet: 's' },
  { title: 'A', url: 'https://x.com/a-dup', date: '1 day ago' },            // dup title
  { title: 'B', url: 'https://x.com/a?utm=1', date: '1 day ago' },           // dup url (query stripped)
  { title: 'C', url: 'https://x.com/', date: '1 day ago' },                  // landing page
  { title: 'D', url: 'https://en.wikipedia.org/wiki/D', date: '1 day ago' }, // blocked host
  { title: 'E', url: 'https://x.com/e', date: old },                         // too old
  { title: 'F', url: 'not a url' },
  { title: 'G1', url: 'https://y.com/1' }, { title: 'G2', url: 'https://y.com/2' },
  { title: 'G3', url: 'https://y.com/3' }, { title: 'G4', url: 'https://y.com/4' }, // 4th from host dropped
]);
check('prepare: dedupe/landing/wiki/old/invalid filtered, host cap 3', prepared.map(p => p.title).join(',') === 'A,G1,G2,G3');
check('prepare: source defaults to host', prepared[0].source === 'x.com');
check('prepare: limit respected', prepareSearchResults(Array.from({ length: 20 }, (_, i) => ({ title: `t${i}`, url: `https://h${i}.com/p` })), 5).length === 5);

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll gather checks passed');
