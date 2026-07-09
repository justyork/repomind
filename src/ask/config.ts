import { defaultModelForProvider, resolveAskProvider } from './llm.js';
import type { LlmProvider } from './types.js';

export interface AskServerConfig {
  serverConfigured: boolean;
  provider: LlmProvider;
  model: string;
}

/** Public ask config for the UI (never exposes the API key). */
export function getAskServerConfig(): AskServerConfig {
  const provider = resolveAskProvider(process.env.REPOMIND_ASK_PROVIDER);
  const envModel = process.env.REPOMIND_ASK_MODEL?.trim();
  return {
    serverConfigured: Boolean(process.env.REPOMIND_ASK_API_KEY?.trim()),
    provider,
    model: envModel || defaultModelForProvider(provider),
  };
}

export function resolveAskApiKey(requestKey: string | undefined): string | null {
  const fromEnv = process.env.REPOMIND_ASK_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const fromRequest = requestKey?.trim();
  return fromRequest || null;
}
