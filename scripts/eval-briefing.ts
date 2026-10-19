// Run the real pipeline for a set of persona topic lists and dump JSON +
// readable markdown for review. Never touches the shared Redis cache.
//
//   node --env-file=.env.local --import tsx scripts/eval-briefing.ts <outDir> [persona,...]
//
// Costs real money (≈$0.012 per topic). Output per persona: <name>.json, <name>.md

delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

import * as fs from 'fs';
import * as path from 'path';
import { generateBriefing, type Briefing } from '../src/lib/briefing-pipeline';

export const PERSONAS: Record<string, { who: string; topics: string[]; length: 'short' | 'medium' | 'long'; tone: 'casual' | 'professional' | 'technical' }> = {
  finance: { who: 'Portfolio manager, reads before the open, wants market-moving facts and numbers', topics: ['Finance', 'Federal Reserve', 'Crypto', 'Stock Market'], length: 'medium', tone: 'professional' },
  ai: { who: 'ML engineer tracking model releases, research, chips and policy', topics: ['AI & Tech', 'Machine Learning Research', 'OpenAI', 'Semiconductors'], length: 'long', tone: 'technical' },
  hobbies: { who: 'Enthusiast who follows motorsport and two niche hobbies', topics: ['Formula 1', 'Speedcubing', 'Mechanical Keyboards', 'NBA'], length: 'medium', tone: 'casual' },
  generalist: { who: 'Busy generalist who wants to know what happened in the world today', topics: ['World News', 'US Politics', 'Climate', 'Health'], length: 'short', tone: 'professional' },
  niche: { who: 'Deep-niche reader: energy tech, a city, indie games, structural biology', topics: ['Small Modular Reactors', 'Boston local news', 'Indie games', 'Protein structure prediction'], length: 'medium', tone: 'professional' },
};

function toMarkdown(name: string, who: string, briefings: Briefing[], ms: number): string {
  const lines = [`# ${name} — ${who}`, `_Generated ${new Date().toISOString()} in ${(ms / 1000).toFixed(1)}s_`, ''];
  for (const b of briefings) {
    lines.push(`## ${b.topic}${b.empty ? ' (EMPTY)' : ''}`, '', ...(b.snapshot ? [`**Markets:** ${b.snapshot}`, ''] : []), b.summary, '');
    b.stories.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.headline}`, `_${s.source ?? '?'} · ${s.date ?? 'no date'} · ${s.url ?? 'no url'}_`);
      for (const bl of s.bullets) lines.push(`- ${bl}`);
      lines.push('');
    });
    if (b.debugInfo) lines.push(`_(internal, not shown to users) gather: ${b.debugInfo.cascadeStep}; queries: ${b.debugInfo.queries.map(q => q.query).join(' | ')}; ${b.debugInfo.articleCount} articles_`, '');
  }
  return lines.join('\n');
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('usage: eval-briefing.ts <outDir> [persona,...]');
  fs.mkdirSync(outDir, { recursive: true });
  const names = process.argv[3] ? process.argv[3].split(',') : Object.keys(PERSONAS);

  for (const name of names) {
    const p = PERSONAS[name];
    if (!p) throw new Error(`unknown persona ${name}`);
    const t0 = Date.now();
    const { briefings } = await generateBriefing(
      p.topics.map(t => ({ name: t })),
      { briefingLength: p.length, tone: p.tone, includeLinks: true, skipCache: true },
    );
    const ms = Date.now() - t0;
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ persona: p, ms, briefings }, null, 2));
    fs.writeFileSync(path.join(outDir, `${name}.md`), toMarkdown(name, p.who, briefings, ms));
    console.log(`${name}: ${briefings.length} topics, ${briefings.reduce((n, b) => n + b.stories.length, 0)} stories, ${briefings.filter(b => b.empty).length} empty, ${(ms / 1000).toFixed(1)}s`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
