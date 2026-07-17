// Offline sanity check for the agentic fetcher's parse + grounding logic.
// No network, no keys. Run with: npx tsx scripts/check-agentic-fetcher.ts

import { parseCandidates, groundCandidates } from '../src/lib/agentic-fetcher';

let failures = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}`);
    failures++;
  }
}

// ─── parseCandidates ─────────────────────────────────────────────────

const wrapped = '```json\n{"articles":[{"title":"A","url":"https://a.com/x","source":"A News","date":"Jul 16, 2026","summary":"s"}]}\n```';
check('parses fenced JSON', parseCandidates(wrapped).length === 1);

const chatty = 'Here is what I found:\n{"articles":[{"title":"A","url":"https://a.com/x"},{"title":"B","url":"https://b.com/y"}]}\nHope that helps!';
check('parses JSON with surrounding prose', parseCandidates(chatty).length === 2);

check('empty on garbage', parseCandidates('no json here').length === 0);
check('empty on wrong shape', parseCandidates('{"stories": []}').length === 0);

// ─── groundCandidates ────────────────────────────────────────────────

const candidates = [
  { title: 'Exact match', url: 'https://real.com/article-1', source: 'Real', date: 'Jul 16, 2026', summary: 'x' },
  { title: 'Host match', url: 'https://real.com/article-2', source: 'Real', date: 'Jul 15, 2026', summary: 'y' },
  { title: 'Fabricated', url: 'https://fabricated.example/made-up', source: 'Fake', date: 'Jul 16, 2026', summary: 'z' },
  { title: 'Bad URL', url: 'not-a-url', summary: 'w' },
  { title: 'Stale', url: 'https://real.com/old', date: 'Jan 1, 2020', summary: 'v' },
];
const citations = [{ url: 'https://real.com/article-1' }, { url: 'https://www.real.com/other' }];

const grounded = groundCandidates(candidates, citations);
check('grounding keeps citation-backed URLs only', grounded.grounded === true && grounded.articles.length === 2);
check('grounding drops fabricated hosts', !grounded.articles.some(a => a.url.includes('fabricated')));
check('grounding drops invalid URLs', !grounded.articles.some(a => a.url === 'not-a-url'));
check('grounding drops stale articles', !grounded.articles.some(a => a.title === 'Stale'));

// When citations would leave too few, fall back to all valid candidates
const sparse = groundCandidates(candidates, [{ url: 'https://unrelated.com/z' }]);
check('falls back to valid candidates when grounding too sparse', sparse.grounded === false && sparse.articles.length === 3);

// No citations at all (some responses omit annotations)
const noCites = groundCandidates(candidates, []);
check('keeps valid candidates when no citations returned', noCites.grounded === false && noCites.articles.length === 3);

// Unknown dates are kept (assembly prompt handles recency)
const undated = groundCandidates([{ title: 'No date', url: 'https://real.com/nd' }], []);
check('keeps candidates with unknown dates', undated.articles.length === 1);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
