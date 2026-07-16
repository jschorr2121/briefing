import * as fs from 'fs';
import * as path from 'path';
import type { VariantResult, MetricsOutput, VariantSummary } from './types.js';

const OUTPUT_DIR = path.join(process.cwd(), 'scripts/diagnostic-compare/output');

export function ensureOutputDir(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function cardToMarkdown(card: VariantResult['briefing']['cards'][0]): string {
  const bullets = card.bullets.map((b) => `- ${b}`).join('\n');
  return `### ${card.headline}\n${bullets}\n**Source**: ${card.source} · **Date**: ${card.date} · [link](${card.url})`;
}

function briefingToMarkdown(result: VariantResult): string {
  const lines: string[] = [`## ${result.topic}`];

  if (result.briefing.executiveSummary) {
    lines.push('', `**Executive summary**: ${result.briefing.executiveSummary}`);
  }

  lines.push('');

  if (result.briefing.cards.length === 0) {
    lines.push('*No results returned.*');
  } else {
    for (const card of result.briefing.cards) {
      lines.push(cardToMarkdown(card), '');
    }
  }

  const m = result.metrics;
  lines.push(
    '---',
    `**Metrics**: latency=${m.latency_ms}ms · cost=${m.cost_estimate_usd.toFixed(4)} USD · results=${m.results_count} · domains=${m.unique_domains}`,
    ''
  );

  return lines.join('\n');
}

export function writeVariantFile(variant: string, results: VariantResult[]): void {
  const lines = [`# ${variant}\n`];
  for (const r of results) {
    lines.push(briefingToMarkdown(r));
  }
  const filePath = path.join(OUTPUT_DIR, `${variant}.md`);
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}`);
}

export function writeComparisonFile(allResults: VariantResult[]): void {
  const byTopic = new Map<string, VariantResult[]>();
  for (const r of allResults) {
    const arr = byTopic.get(r.topic) || [];
    arr.push(r);
    byTopic.set(r.topic, arr);
  }

  const lines = ['# Side-by-Side Comparison\n'];

  for (const [topic, results] of byTopic) {
    lines.push(`## Topic: ${topic}\n`);
    lines.push('| Variant | Latency | Cost | Results | Domains |');
    lines.push('|---|---|---|---|---|');
    for (const r of results) {
      const m = r.metrics;
      lines.push(
        `| ${r.variant} | ${m.latency_ms}ms | $${m.cost_estimate_usd.toFixed(4)} | ${m.results_count} | ${m.unique_domains} |`
      );
    }
    lines.push('');

    for (const r of results) {
      lines.push(briefingToMarkdown(r));
    }
  }

  const filePath = path.join(OUTPUT_DIR, 'comparison.md');
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}`);
}

export function writeMetricsFile(allResults: VariantResult[]): void {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const topics = [...new Set(allResults.map((r) => r.topic))];

  const variantMap: Record<string, VariantSummary> = {};

  for (const r of allResults) {
    if (!variantMap[r.variant]) {
      variantMap[r.variant] = { by_topic: {}, total_cost_usd: 0, total_latency_ms: 0 };
    }
    variantMap[r.variant].by_topic[r.topic] = r.metrics;
    variantMap[r.variant].total_cost_usd += r.metrics.cost_estimate_usd;
    variantMap[r.variant].total_latency_ms += r.metrics.latency_ms;
  }

  const grand_total = Object.values(variantMap).reduce((sum, v) => sum + v.total_cost_usd, 0);

  const output: MetricsOutput = {
    run_id: runId,
    topics,
    variants: variantMap,
    grand_total_cost_usd: grand_total,
  };

  const filePath = path.join(OUTPUT_DIR, 'metrics.json');
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}`);
}
