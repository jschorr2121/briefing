// Model configuration via environment variables
// Set BRIEFING_MODEL to change the generation model
// Options: gpt-5-nano, gpt-4o, gpt-4o-mini, perplexity
// Set TTS_PROVIDER to change TTS provider
// Options: openai, google

export type GenerationModel = 'gpt-5-nano' | 'gpt-4o' | 'gpt-4o-mini' | 'perplexity';
export type TTSProvider = 'openai' | 'google';

export function getGenerationModel(): GenerationModel {
  const model = process.env.BRIEFING_MODEL?.toLowerCase() || 'gpt-5-nano';
  if (['gpt-5-nano', 'gpt-4o', 'gpt-4o-mini', 'perplexity'].includes(model)) {
    return model as GenerationModel;
  }
  return 'gpt-5-nano';
}

export function getTTSProvider(): TTSProvider {
  const provider = process.env.TTS_PROVIDER?.toLowerCase() || 'openai';
  if (['openai', 'google'].includes(provider)) {
    return provider as TTSProvider;
  }
  return 'openai';
}

export function getOpenAIModel(): string {
  const model = getGenerationModel();
  if (model === 'perplexity') return 'gpt-5-nano'; // fallback
  return model;
}

// Model pricing info (per 1K tokens/chars)
export const MODEL_PRICING = {
  'gpt-5-nano': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'perplexity': { request: 0.005 }, // per request for sonar-small
  'openai-tts': { chars: 0.015 },
  'google-tts': { chars: 0.004 },
};
