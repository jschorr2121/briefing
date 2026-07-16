import * as readline from 'readline';

interface VariantCost {
  name: string;
  calls: number;
  estCost: string;
  subtotal: string;
}

const VARIANT_COSTS: VariantCost[] = [
  { name: 'perigon-raw-articles', calls: 4, estCost: '$0.008', subtotal: '$0.03' },
  { name: 'perigon-raw-stories', calls: 4, estCost: '$0.008', subtotal: '$0.03' },
  { name: 'perigon-raw-vector', calls: 4, estCost: '$0.008', subtotal: '$0.03' },
  { name: 'perigon-flow-news-rebuild', calls: 4, estCost: '1–4 API calls each', subtotal: '$0.10' },
  { name: 'perigon-flow-master', calls: 4, estCost: '1–4 API calls each', subtotal: '$0.10' },
  { name: 'perigon-agent', calls: 4, estCost: 'tokens + $0.024', subtotal: '$0.15' },
  { name: 'newsdata-direct', calls: 4, estCost: '$0.010', subtotal: '$0.04' },
  { name: 'newsdata-agent', calls: 4, estCost: 'tokens + $0.020', subtotal: '$0.08' },
  { name: 'brave-direct', calls: 4, estCost: '$0.005', subtotal: '$0.02' },
  { name: 'brave-agent', calls: 4, estCost: 'tokens + $0.010', subtotal: '$0.07' },
  { name: 'tavily-direct', calls: 4, estCost: '$0.008', subtotal: '$0.03' },
  { name: 'tavily-agent', calls: 4, estCost: 'tokens + $0.016', subtotal: '$0.08' },
  { name: 'exa-direct', calls: 4, estCost: 'actual', subtotal: '~$0.03' },
  { name: 'exa-agent', calls: 4, estCost: 'tokens + actual', subtotal: '$0.08' },
  { name: 'claude-sonnet-4-6-websearch', calls: 4, estCost: '~3 searches + tokens', subtotal: '$0.20' },
  { name: 'gpt-4o-websearch', calls: 4, estCost: 'tokens', subtotal: '$0.06' },
  { name: 'gpt-5.4-mini polish', calls: 20, estCost: '~$0.0003 each', subtotal: '$0.01' },
];

export function printCostPreview(activeVariants: string[]): void {
  const active = VARIANT_COSTS.filter(
    (v) => activeVariants.length === 0 || activeVariants.some((a) => v.name.startsWith(a))
  );

  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                    COST PREVIEW (estimated)                      │');
  console.log('├───────────────────────────────┬────────┬────────────────┬────────┤');
  console.log('│ Variant                        │ Calls  │ Est. cost/call │ Total  │');
  console.log('├───────────────────────────────┬────────┬────────────────┬────────┤');
  for (const v of active) {
    const name = v.name.padEnd(30).slice(0, 30);
    const calls = String(v.calls).padEnd(6);
    const cost = v.estCost.padEnd(14).slice(0, 14);
    console.log(`│ ${name} │ ${calls} │ ${cost} │ ${v.subtotal.padEnd(6)} │`);
  }
  console.log('├───────────────────────────────┴────────┴────────────────┴────────┤');
  console.log('│ Grand total per run: ~$1.25                                       │');
  console.log('└───────────────────────────────────────────────────────────────────┘\n');
}

export async function waitForConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Press Enter to proceed, or Ctrl+C to abort... ', () => {
      rl.close();
      resolve(true);
    });
  });
}
