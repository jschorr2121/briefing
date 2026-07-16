export interface CliOptions {
  skipAgent: boolean;
  variants: string[] | null; // null = all
  agentModel: 'claude' | 'gpt';
  dryRun: boolean;
  yes: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const opts: CliOptions = {
    skipAgent: false,
    variants: null,
    agentModel: 'claude',
    dryRun: false,
    yes: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skip-agent') {
      opts.skipAgent = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      opts.yes = true;
    } else if (arg === '--variants' && args[i + 1]) {
      opts.variants = args[++i].split(',').map((v) => v.trim());
    } else if (arg === '--agent-model' && args[i + 1]) {
      const model = args[++i];
      if (model === 'claude' || model === 'gpt') opts.agentModel = model;
    }
  }

  return opts;
}
