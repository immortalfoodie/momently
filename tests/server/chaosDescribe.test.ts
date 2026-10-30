import { describe, expect, it } from 'vitest';
import { ok } from '@/lib/result';
import type { LLMProvider } from '@/llm/types';
import { createDeps } from '@/server/deps';
import { handleChaosDescribe } from '@/server/handlers/chaosDescribe';

const BODY = {
  text: 'Heavy rain and the photographer cancelled',
  vendorCategories: ['photography', 'food'],
  itemFamilies: [{ family: 'decor_theme', label: 'Theme decor' }],
  setting: 'outdoor',
  guestCount: 80,
};

function post(body: unknown): Request {
  return new Request('http://localhost:3000/api/chaos/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Server: Chaos describe handler', () => {
  it('maps a description to scenarios in demo mode', async () => {
    const res = await handleChaosDescribe(post(BODY), createDeps({ mode: 'demo' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scenarios).toEqual([{ type: 'rain' }, { type: 'vendor_cancels', category: 'photography' }]);
    expect(json.mode).toBe('demo');
    expect(json.degraded).toBe(false);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('rejects invalid payloads with 400 and oversized bodies with 413', async () => {
    const deps = createDeps({ mode: 'demo' });
    expect((await handleChaosDescribe(post({ ...BODY, text: '' }), deps)).status).toBe(400);
    expect((await handleChaosDescribe(post({ ...BODY, guestCount: 0 }), deps)).status).toBe(400);
    const huge = { ...BODY, padding: 'x'.repeat(9000) };
    expect((await handleChaosDescribe(post(huge), deps)).status).toBe(413);
  });

  it('falls back to the offline reader when the live model returns invalid output', async () => {
    const badProvider: LLMProvider = {
      name: 'bad-live',
      async complete() {
        return ok('{"scenarios":[{"type":"meteor"}],"understood":"x"}');
      },
    };
    const res = await handleChaosDescribe(post(BODY), createDeps({ provider: badProvider, mode: 'live' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.degraded).toBe(true);
    expect(json.scenarios[0]).toEqual({ type: 'rain' });
  });

  it('returns a generic 503 without leaking provider details', async () => {
    const leaky: LLMProvider = {
      name: 'leaky',
      async complete() {
        return {
          ok: false,
          error: { code: 'provider_unavailable', message: 'key sk-secret at /srv/x.ts', retryable: false },
        };
      },
    };
    const res = await handleChaosDescribe(post(BODY), createDeps({ provider: leaky, mockProvider: leaky }));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain('sk-secret');
    expect(text).not.toContain('/srv/x.ts');
  });
});
