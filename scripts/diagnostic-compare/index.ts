import * as fs from 'fs';
import * as path from 'path';
import { TOPICS } from './topics.js';
import { parseArgs } from './cli.js';
import { printCostPreview, waitForConfirmation } from './cost-preview.js';
import { ensureOutputDir, writeVariantFile, writeComparisonFile, writeMetricsFile } from './render.js';
import type { VariantResult } from './types.js';

// Variant modules — static imports avoid tsx CJS dynamic-import deadlocks
import * as perigonRaw from './variants/perigon-raw.js';
import * as perigonFlowNR from './variants/perigon-flow-news-rebuild.js';
import * as perigonFlowMaster from './variants/perigon-flow-master.js';
import * as perigonAgent from './variants/perigon-agent.js';
import * as newsdataDirect from './variants/newsdata-direct.js';
import * as newsdataAgent from './variants/newsdata-agent.js';
import * as braveDirect from './variants/brave-direct.js';
import * as braveAgent from './variants/brave-agent.js';
import * as tavilyDirect from './variants/tavily-direct.js';
import * as tavilyAgent from './variants/tavily-agent.js';
import * as exaDirect from './variants/exa-direct.js';
import * as exaAgent from './variants/exa-agent.js';
import * as claudeWS from './variants/claude-websearch.js';
import * as gptWS from './variants/gpt-websearch.js';

// Load .env.local after static imports (variant modules only read env vars inside their run() calls)
(function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found — rely on process.env
  }
})();

// ─── Variant registry ────────────────────────────────────────────────

type RunFn = (topic: string, config: (typeof TOPICS)[0], dryRun: boolean) => Promise<VariantResult>;

interface VariantEntry {
  name: string;
  run: RunFn;
  isAgent?: boolean;
}

const ALL_VARIANTS: VariantEntry[] = [
  { name: 'perigon-raw-articles',        run: (t, c, d) => perigonRaw.runArticles(t, c, d) },
  { name: 'perigon-raw-stories',         run: (t, c, d) => perigonRaw.runStories(t, c, d) },
  { name: 'perigon-raw-vector',          run: (t, c, d) => perigonRaw.runVector(t, c, d) },
  { name: 'perigon-flow-news-rebuild',   run: perigonFlowNR.run },
  { name: 'perigon-flow-master',         run: perigonFlowMaster.run },
  { name: 'perigon-agent',               run: perigonAgent.run,     isAgent: true },
  { name: 'newsdata-direct',             run: newsdataDirect.run },
  { name: 'newsdata-agent',              run: newsdataAgent.run,    isAgent: true },
  { name: 'brave-direct',               run: braveDirect.run },
  { name: 'brave-agent',                run: braveAgent.run,       isAgent: true },
  { name: 'tavily-direct',              run: tavilyDirect.run },
  { name: 'tavily-agent',               run: tavilyAgent.run,      isAgent: true },
  { name: 'exa-direct',                 run: exaDirect.run },
  { name: 'exa-agent',                  run: exaAgent.run,         isAgent: true },
  { name: 'claude-sonnet-4-6-websearch', run: claudeWS.run,        isAgent: true },
  { name: 'gpt-4o-websearch',            run: gptWS.run,           isAgent: true },
];

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  const { dryRun, skipAgent, variants: variantFilter } = opts;

  console.log('\n🗞  Briefing Diagnostic — Source Comparison Tool');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | Topics: ${TOPICS.length} | Skip agents: ${skipAgent}`);

  ensureOutputDir();

  const allVariants = skipAgent ? ALL_VARIANTS.filter((v) => !v.isAgent) : ALL_VARIANTS;
  const activeVariants = variantFilter
    ? allVariants.filter((v) => variantFilter.includes(v.name))
    : allVariants;

  if (activeVariants.length === 0) {
    console.error('No variants selected. Check --variants flag.');
    process.exit(1);
  }

  console.log(`   Variants: ${activeVariants.map((v) => v.name).join(', ')}\n`);

  if (!dryRun) {
    printCostPreview(activeVariants.map((v) => v.name));
    if (!opts.yes) await waitForConfirmation();
  }

  const allResults: VariantResult[] = [];

  for (const variant of activeVariants) {
    console.log(`\n▶ Running variant: ${variant.name}`);
    const variantResults: VariantResult[] = [];

    for (let ti = 0; ti < TOPICS.length; ti++) {
      const topicConfig = TOPICS[ti];
      const topic = topicConfig.label;
      // Pace agent/LLM variants: 70s between topics to respect the 30k tokens/min rate limit
      if (variant.isAgent && ti > 0) {
        process.stdout.write(`  [pacing 70s for rate limit...]\n`);
        await new Promise((r) => setTimeout(r, 70_000));
      }
      process.stdout.write(`  ${topic}... `);
      try {
        const result = await variant.run(topic, topicConfig, dryRun);
        variantResults.push(result);
        allResults.push(result);
        const m = result.metrics;
        console.log(`✓ ${m.latency_ms}ms · $${m.cost_estimate_usd.toFixed(4)} · ${m.results_count} cards · ${m.unique_domains} domains${m.error ? ` ⚠ ${m.error}` : ''}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`✗ ERROR: ${errorMsg}`);
        variantResults.push({
          variant: variant.name,
          topic,
          briefing: { cards: [] },
          metrics: {
            latency_ms: 0,
            cost_estimate_usd: 0,
            cost_basis: 'error',
            results_count: 0,
            unique_domains: 0,
            error: errorMsg,
          },
        });
      }
    }

    writeVariantFile(variant.name, variantResults);
  }

  console.log('\n📝 Writing output files...');
  writeComparisonFile(allResults);
  writeMetricsFile(allResults);

  console.log('\n✅ Done! Results in scripts/diagnostic-compare/output/');
  console.log('   Open output/comparison.md for side-by-side view.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
