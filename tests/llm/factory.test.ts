import { describe, expect, it } from 'vitest';
import { createProviderFromEnv } from '@/llm/factory';
import { GeminiProvider } from '@/llm/geminiProvider';
import { MockProvider } from '@/llm/mock/mockProvider';

describe('LLM Provider Factory', () => {
  it('returns MockProvider in demo mode by default when env is empty or unset', () => {
    const resEmpty = createProviderFromEnv({});
    expect(resEmpty.mode).toBe('demo');
    expect(resEmpty.provider).toBeInstanceOf(MockProvider);
    expect(resEmpty.provider.name).toBe('mock');

    const resMock = createProviderFromEnv({ LLM_PROVIDER: 'mock' });
    expect(resMock.mode).toBe('demo');
    expect(resMock.provider).toBeInstanceOf(MockProvider);
  });

  it('falls back to demo mode with an explanatory note when gemini is requested without an API key', () => {
    const res = createProviderFromEnv({ LLM_PROVIDER: 'gemini' });
    expect(res.mode).toBe('demo');
    expect(res.provider).toBeInstanceOf(MockProvider);
    expect(res.note).toBe('GEMINI_API_KEY is not set, running in demo mode');
  });

  it('returns live GeminiProvider when gemini is requested with an API key', () => {
    const res = createProviderFromEnv({
      LLM_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test_api_key_123',
    });
    expect(res.mode).toBe('live');
    expect(res.provider).toBeInstanceOf(GeminiProvider);
    expect(res.provider.name).toBe('gemini');
    expect(res.note).toBeUndefined();
  });

  it('falls back to demo mode with a note when an unknown provider name is supplied', () => {
    const res = createProviderFromEnv({ LLM_PROVIDER: 'claude_or_openai' });
    expect(res.mode).toBe('demo');
    expect(res.provider).toBeInstanceOf(MockProvider);
    expect(res.note).toContain('Unknown LLM_PROVIDER');
  });

  it('never throws regardless of malformed inputs', () => {
    expect(() => createProviderFromEnv({ LLM_PROVIDER: undefined, GEMINI_API_KEY: undefined })).not.toThrow();
    expect(() => createProviderFromEnv({ LLM_PROVIDER: '   ' })).not.toThrow();
  });
});
