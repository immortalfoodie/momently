import { describe, expect, it } from 'vitest';
import { GeminiProvider, type GeminiClientLike } from '@/llm/geminiProvider';
import type { LlmRequest } from '@/llm/types';

describe('GeminiProvider (Official SDK Wrapper)', () => {
  const secretKey = 'SECRET_KEY_AIzaSy_MOMENTLY_TOP_SECRET_123';

  const sampleRequest: LlmRequest = {
    task: 'intake',
    system: 'You are an intake assistant',
    user: 'Plan a party in Mumbai for 50 people',
    input: {},
    temperature: 0.1,
    maxOutputTokens: 1024,
    timeoutMs: 5000,
  };

  it('successfully completes and returns text from client generateContent', async () => {
    const fakeClient: GeminiClientLike = {
      models: {
        async generateContent(params) {
          expect(params.model).toBe('gemini-2.5-flash');
          expect(params.contents).toBe(sampleRequest.user);
          expect(params.config?.responseMimeType).toBe('application/json');
          return {
            text: '{"title": "Mumbai Celebration"}',
            candidates: [{ finishReason: 'STOP' }],
          };
        },
      },
    };

    const provider = new GeminiProvider({
      apiKey: secretKey,
      client: fakeClient,
    });

    const res = await provider.complete(sampleRequest);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe('{"title": "Mumbai Celebration"}');
    }
  });

  it('maps HTTP 429 rate limit errors to rate_limited and retryable: true', async () => {
    const fakeClient: GeminiClientLike = {
      models: {
        async generateContent() {
          const err = new Error('Quota exceeded for quota metric');
          (err as unknown as { status: number }).status = 429;
          throw err;
        },
      },
    };

    const provider = new GeminiProvider({
      apiKey: secretKey,
      client: fakeClient,
    });

    const res = await provider.complete(sampleRequest);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('rate_limited');
      expect(res.error.retryable).toBe(true);
      expect(res.error.message).not.toContain(secretKey);
    }
  });

  it('maps client timeout or abort to timeout and retryable: true', async () => {
    const fakeClient: GeminiClientLike = {
      models: {
        async generateContent() {
          const err = new Error('The operation was aborted due to timeout');
          err.name = 'AbortError';
          throw err;
        },
      },
    };

    const provider = new GeminiProvider({
      apiKey: secretKey,
      client: fakeClient,
    });

    const res = await provider.complete(sampleRequest);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('timeout');
      expect(res.error.retryable).toBe(true);
      expect(res.error.message).not.toContain(secretKey);
    }
  });

  it('maps 401/403 authentication failures to config and retryable: false', async () => {
    const fakeClient: GeminiClientLike = {
      models: {
        async generateContent() {
          const err = new Error('API_KEY_INVALID: Key not found');
          (err as unknown as { status: number }).status = 401;
          throw err;
        },
      },
    };

    const provider = new GeminiProvider({
      apiKey: secretKey,
      client: fakeClient,
    });

    const res = await provider.complete(sampleRequest);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('config');
      expect(res.error.retryable).toBe(false);
      expect(res.error.message).not.toContain(secretKey);
    }
  });

  it('maps candidate safety or blocklist finish reasons to blocked', async () => {
    const fakeClient: GeminiClientLike = {
      models: {
        async generateContent() {
          return {
            text: '',
            candidates: [{ finishReason: 'SAFETY' }],
          };
        },
      },
    };

    const provider = new GeminiProvider({
      apiKey: secretKey,
      client: fakeClient,
    });

    const res = await provider.complete(sampleRequest);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('blocked');
      expect(res.error.retryable).toBe(false);
      expect(res.error.message).not.toContain(secretKey);
    }
  });

  it('ensures no error message ever contains the API key, prompt text, or user text', async () => {
    const sensitiveUserText = 'Confidential host details 9876543210';
    const fakeClient: GeminiClientLike = {
      models: {
        async generateContent() {
          throw new Error(`Failed with key ${secretKey} while processing ${sensitiveUserText}`);
        },
      },
    };

    const provider = new GeminiProvider({
      apiKey: secretKey,
      client: fakeClient,
    });

    const res = await provider.complete({
      ...sampleRequest,
      user: sensitiveUserText,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).not.toContain(secretKey);
      expect(res.error.message).not.toContain(sensitiveUserText);
    }
  });
});
