// Offline sanity check for src/lib/gather.ts parsing + result preparation.
// No network, no keys. Run with: npx tsx scripts/check-gather.ts

import { parsePlannedQueries, prepareSearchResults, normalizeDate, parseKeepIndices, looksEnglish, extractBodyText } from '../src/lib/gather';

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) failures++;
}

check('planner: plain JSON', JSON.stringify(parsePlannedQueries('{"queries":["a","b"]}', 't').queries) === '["a","b"]');
check('planner: fenced JSON', parsePlannedQueries('```json\n{"queries":["x"]}\n```', 't').queries[0] === 'x');
check('planner: garbage → topic', parsePlannedQueries('no json', 'my topic').queries[0] === 'my topic');
check('planner: caps at 3', parsePlannedQueries('{"queries":["a","b","c","d"]}', 't').queries.length === 3);
check('planner: drops non-strings', JSON.stringify(parsePlannedQueries('{"queries":["a", 42, ""]}', 't').queries) === '["a"]');
check('planner: niche flag parsed', parsePlannedQueries('{"queries":["a"],"niche":true}', 't').niche === true);
check('planner: niche defaults false', parsePlannedQueries('{"queries":["a"]}', 't').niche === false);
check('planner: market + resultQuery + communitySites parsed', (() => { const p = parsePlannedQueries('{"queries":["a"],"market":true,"resultQuery":"Singapore Grand Prix result","communitySites":["https://www.geekhack.org/index.php","kbd.news"]}', 't'); return p.market && p.resultQuery === 'Singapore Grand Prix result' && JSON.stringify(p.communitySites) === '["geekhack.org","kbd.news"]'; })());
check('planner: resultQuery null when missing', parsePlannedQueries('{"queries":["a"]}', 't').resultQuery === null);

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

// ─── assembler bullet guard ──────────────────────────────────────────
import { cleanBullet } from '../src/lib/briefing-assembler';
check('bullet: drops "source reminder:"', cleanBullet('source reminder: New York Times') === null);
check('bullet: drops "date:"', cleanBullet('date: Oct 17, 2026') === null);
check('bullet: drops "The report was published Oct 19, 2026."', cleanBullet('The report was published Oct 19, 2026.') === null);
check('bullet: strips "The Guardian reported that"', cleanBullet('The Guardian reported that arrests rose to 1,800 in Paris.') === 'Arrests rose to 1,800 in Paris.');
check('bullet: strips "AP reports," with comma', cleanBullet('AP reports, Katie Zacharia left her role after a rocky start.') === 'Katie Zacharia left her role after a rocky start.');
check('bullet: does NOT strip "X described the model as" (would leave a fragment)', cleanBullet('The Information described the model as improving reasoning over earlier models.') === 'The Information described the model as improving reasoning over earlier models.');
check('url date: /2026/10/16/ beats page_age', prepareSearchResults([{ title: 'T', url: 'https://x.com/2026/10/16/story', date: '2026-10-19T00:00:00Z' }])[0].date.startsWith('Oct 16'));
check('body: paragraphs extracted, nav/script dropped', extractBodyText('<html><script>var x=1</script><nav><p>Home | News | Sports | Weather | Login</p></nav><p>The Federal Reserve held rates steady on Wednesday, with Chair Warsh saying inflation remains above target.</p><p>Short.</p><p>Markets had priced a 90% chance of no change, according to CME FedWatch data published Tuesday.</p></html>') === 'The Federal Reserve held rates steady on Wednesday, with Chair Warsh saying inflation remains above target. Markets had priced a 90% chance of no change, according to CME FedWatch data published Tuesday.');
check('bullet: keeps plain facts', cleanBullet('Lavrov visited Tehran for the first time since the war began.') === 'Lavrov visited Tehran for the first time since the war began.');
check('bullet: keeps sentences starting with a name + verb', cleanBullet('Nvidia acquired Modal for $1.5B.') === 'Nvidia acquired Modal for $1.5B.');

check('lang: English snippet passes', looksEnglish('The Fed held rates steady on Wednesday as markets had expected, with the chair saying inflation is still too high.'));
check('lang: Portuguese snippet dropped', !looksEnglish('Ducky apresenta novo teclado mecânico Cushion 98 com três tipos de ligação e uma autonomia anunciada de até 63 horas'));
check('lang: short titles are not judged', looksEnglish('Ducky Cushion 98'));

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll gather checks passed');
