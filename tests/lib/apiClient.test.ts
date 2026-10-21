import { describe, expect, it } from 'vitest';
import {
  fetchHealth,
  requestNarration,
  sendMessage,
  submitIntake,
} from '@/lib/apiClient';

describe('Lib: API Client', () => {
  it('successfully fetches health with injectable fetch', async () => {
    const fakeFetch: typeof fetch = async (url) => {
      expect(url).toBe('/api/health');
      return new Response(JSON.stringify({ mode: 'live', note: 'Ready' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await fetchHealth({ fetchFn: fakeFetch });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.mode).toBe('live');
    expect(result.value.note).toBe('Ready');
  });

  it('submits intake and parses response correctly', async () => {
    const fakeFetch: typeof fetch = async (url, init) => {
      expect(url).toBe('/api/intake');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(init?.body as string);
      expect(body.text).toBe('25th anniversary');

      return new Response(
        JSON.stringify({
          plan: { id: 'p_1' },
          fit: { fits: true },
          assumptions: [],
          missingInfo: [],
          mode: 'demo',
          degraded: false,
          notes: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const res = await submitIntake('25th anniversary', { fetchFn: fakeFetch });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.mode).toBe('demo');
    expect(res.value.plan.id).toBe('p_1');
  });

  it('maps an HTTP error response body to ClientError', async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'invalid_request',
            message: 'Invalid message payload',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const res = await sendMessage(
      // @ts-expect-error Testing client error mapping with minimal payload
      { message: 'hi', plan: {} },
      { fetchFn: fakeFetch },
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('invalid_request');
    expect(res.error.message).toBe('Invalid message payload');
  });

  it('parses Retry-After header on 429 rate limit responses', async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'rate_limited',
            message: 'Too many requests. Please wait a moment before trying again.',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '15',
          },
        },
      );
    };

    const res = await submitIntake('test brief', { fetchFn: fakeFetch });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('rate_limited');
    expect(res.error.retryAfterSeconds).toBe(15);
  });

  it('maps unexpected network connection failures to code "network" without throwing', async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new TypeError('Failed to fetch: Connection refused');
    };

    // Must never throw
    const res = await fetchHealth({ fetchFn: fakeFetch });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('network');
    expect(res.error.message).toContain('Failed to fetch');
  });

  it('handles client timeout gracefully without throwing', async () => {
    const fakeFetch: typeof fetch = async (_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    const res = await requestNarration(
      { purpose: 'budget_explainer', facts: {} },
      { fetchFn: fakeFetch, timeoutMs: 10 },
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('network');
    expect(res.error.message).toContain('timed out');
  });
});
