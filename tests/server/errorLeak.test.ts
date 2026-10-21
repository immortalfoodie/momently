import { describe, expect, it } from 'vitest';
import type { LLMProvider } from '@/llm/types';
import { createDeps } from '@/server/deps';
import { handleHealth } from '@/server/handlers/health';
import { handleIntake } from '@/server/handlers/intake';
import { handleNarrate } from '@/server/handlers/narrate';

describe('Server: Security - Error Leak Prevention', () => {
  const SECRET_API_KEY = 'sk-proj-secret-gemini-live-key-xyz12345';
  const INTERNAL_PATH = 'c:/Users/Yash/momently/src/server/secretKeys.ts';
  const STACK_SNIPPET = 'Error: Connection lost\n    at dispatchInternal (c:/Users/Yash/momently/src/server/secretKeys.ts:88:12)';

  const leakyProvider: LLMProvider = {
    name: 'leaky-provider',
    async complete() {
      return {
        ok: false,
        error: {
          code: 'provider_unavailable',
          message: `Internal fault with key ${SECRET_API_KEY} at ${INTERNAL_PATH}\n${STACK_SNIPPET}`,
          retryable: false,
        },
      };
    },
  };

  it('intake handler never leaks upstream provider errors, keys, or file paths in response bodies', async () => {
    const deps = createDeps({
      provider: leakyProvider,
      mockProvider: leakyProvider,
    });

    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Anniversary celebration with 80 guests' }),
    });

    const res = await handleIntake(req, deps);
    expect(res.status).toBe(503);

    const bodyText = await res.text();
    expect(bodyText).not.toContain(SECRET_API_KEY);
    expect(bodyText).not.toContain(INTERNAL_PATH);
    expect(bodyText).not.toContain('secretKeys.ts');
    expect(bodyText).not.toContain('dispatchInternal');

    const json = JSON.parse(bodyText);
    expect(json.error.code).toBe('ai_unavailable');
    expect(json.error.message).toBe(
      'The event planning assistant is temporarily unavailable. Please try again in a few moments.',
    );
  });

  it('narrate handler never leaks upstream provider errors, keys, or file paths in response bodies', async () => {
    const deps = createDeps({
      provider: leakyProvider,
      mockProvider: leakyProvider,
    });

    const req = new Request('http://localhost:3000/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: 'budget_explainer',
        facts: { headline: 'Test' },
      }),
    });

    const res = await handleNarrate(req, deps);
    expect(res.status).toBe(503);

    const bodyText = await res.text();
    expect(bodyText).not.toContain(SECRET_API_KEY);
    expect(bodyText).not.toContain(INTERNAL_PATH);
    expect(bodyText).not.toContain('secretKeys.ts');
    expect(bodyText).not.toContain('dispatchInternal');

    const json = JSON.parse(bodyText);
    expect(json.error.code).toBe('ai_unavailable');
  });

  it('health endpoint never reveals API keys or private env values in mode or note', async () => {
    const deps = createDeps({
      mode: 'live',
      modeNote: 'Gemini configured with secure server credentials',
    });

    const req = new Request('http://localhost:3000/api/health', {
      method: 'GET',
    });

    const res = await handleHealth(req, deps);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain(SECRET_API_KEY);
    expect(bodyText).not.toContain('process.env');

    const json = JSON.parse(bodyText);
    expect(json).toEqual({
      mode: 'live',
      note: 'Gemini configured with secure server credentials',
    });
  });

  it('http guard never echoes user inputs or internal paths in JSON syntax error responses', async () => {
    const deps = createDeps();
    const maliciousPayload = `{"text": "my_secret_token_${SECRET_API_KEY}", invalid_json}`;

    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: maliciousPayload,
    });

    const res = await handleIntake(req, deps);
    expect(res.status).toBe(400);

    const bodyText = await res.text();
    expect(bodyText).not.toContain(SECRET_API_KEY);
    expect(bodyText).not.toContain('my_secret_token');

    const json = JSON.parse(bodyText);
    expect(json.error.code).toBe('invalid_request');
    expect(json.error.message).toBe('Malformed JSON payload');
  });
});
