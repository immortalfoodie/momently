import { GeminiProvider } from './geminiProvider';
import { MockProvider } from './mock/mockProvider';
import type { LLMProvider } from './types';

/**
 * Result returned by provider factory.
 * WHY: Clearly communicates runtime execution mode (live vs demo) without exposing secret credentials.
 */
export interface ProviderFactoryResult {
  provider: LLMProvider;
  mode: 'live' | 'demo';
  note?: string;
}

/**
 * Instantiates the appropriate LLM provider based exclusively on injected environment variables.
 * WHY: Seamlessly degrades to offline Mock demo mode when API keys are missing or invalid,
 * strictly forbidding logging or leakage of sensitive API keys.
 *
 * @param env - Injected environment dictionary (e.g. process.env).
 * @returns Configured provider, mode ('live' | 'demo'), and optional operational note.
 */
export function createProviderFromEnv(
  env: Record<string, string | undefined>,
): ProviderFactoryResult {
  const providerKey = env.LLM_PROVIDER?.toLowerCase().trim();
  const apiKey = env.GEMINI_API_KEY?.trim();
  const model = env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  if (!providerKey || providerKey === 'mock') {
    return {
      provider: new MockProvider(),
      mode: 'demo',
    };
  }

  if (providerKey === 'gemini') {
    if (apiKey) {
      return {
        provider: new GeminiProvider({ apiKey, model }),
        mode: 'live',
      };
    }
    return {
      provider: new MockProvider(),
      mode: 'demo',
      note: 'GEMINI_API_KEY is not set, running in demo mode',
    };
  }

  return {
    provider: new MockProvider(),
    mode: 'demo',
    note: `Unknown LLM_PROVIDER "${providerKey}", running in demo mode`,
  };
}
