// Model selection via env vars. Any OpenAI chat model id is accepted.
//
// Defaults measured Oct 19 2026 on the real assembly prompt (same 10-article
// input, per topic):
//   gpt-5-nano      51–76s  $0.002–0.003  reasons into 4–8k output tokens, picked ads
//   gpt-5.4-nano     5–7s   $0.0015       clean picks, but ignores "no meta-narration" rules
//   gpt-5.6-luna    12–14s  $0.0017       follows the prompt: leads with the biggest story,
//                                         direct factual bullets (persona eval, Oct 19)  ← default
//   claude-sonnet-5.5 13s   $0.025        best prose; 16× the price
// Topics assemble in parallel, so Luna's extra seconds cost ~6s per briefing, not per topic.

export function getAssemblyModel(): string {
  return process.env.BRIEFING_MODEL || 'gpt-5.6-luna';
}

/** Query planner + relevance gate: tiny prompts, nano is plenty. */
export function getPlannerModel(): string {
  return process.env.SEARCH_PLANNER_MODEL || 'gpt-5.4-nano';
}

export type TTSProvider = 'openai' | 'google';

export function getTTSProvider(): TTSProvider {
  return process.env.TTS_PROVIDER?.toLowerCase() === 'google' ? 'google' : 'openai';
}
