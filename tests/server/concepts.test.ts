import { describe, expect, it } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { err } from '@/lib/result';
import type { LLMProvider } from '@/llm/types';
import { createDeps } from '@/server/deps';
import { handleConcepts } from '@/server/handlers/concepts';

describe('Server: Concepts Handler', () => {
  it('generates 3 engine-priced concepts for an active plan', async () => {
    const deps = createDeps({ mode: 'demo' });
    const ctx = { ids: deps.ids, clock: deps.clock };
    const demo = buildDemoPlan(ctx);

    const req = new Request('http://localhost:3000/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: demo.plan }),
    });

    const res = await handleConcepts(req, deps);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.concepts).toHaveLength(3);
    expect(json.degraded).toBe(false);
    expect(json.concepts[0].estimatedTotal).toBeGreaterThan(0);
  });

  it('rejects tampered or missing plan with 400', async () => {
    const deps = createDeps();

    const reqMissing = new Request('http://localhost:3000/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resMissing = await handleConcepts(reqMissing, deps);
    expect(resMissing.status).toBe(400);

    const reqTampered = new Request('http://localhost:3000/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: { id: 'invalid', meta: { guestCount: -5 } } }),
    });
    const resTampered = await handleConcepts(reqTampered, deps);
    expect(resTampered.status).toBe(400);
  });

  it('degrades to mock provider when primary provider fails with network error', async () => {
    const failingPrimary: LLMProvider = {
      name: 'failing-gemini',
      async complete() {
        return err({
          code: 'provider_unavailable',
          message: 'Upstream connection reset',
          retryable: true,
        });
      },
    };

    const deps = createDeps({
      provider: failingPrimary,
      mode: 'live',
    });
    const ctx = { ids: deps.ids, clock: deps.clock };
    const demo = buildDemoPlan(ctx);

    const req = new Request('http://localhost:3000/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: demo.plan }),
    });

    const res = await handleConcepts(req, deps);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.concepts).toHaveLength(3);
    expect(json.degraded).toBe(true);
  });

  it('returns 503 without leaking secrets when both primary and mock fail', async () => {
    const failingProvider: LLMProvider = {
      name: 'failing-all',
      async complete() {
        return err({
          code: 'provider_unavailable',
          message: 'Secret key sk-test-12345 failed authentication',
          retryable: false,
        });
      },
    };

    const deps = createDeps({
      provider: failingProvider,
      mockProvider: failingProvider,
      mode: 'demo',
    });
    const ctx = { ids: deps.ids, clock: deps.clock };
    const demo = buildDemoPlan(ctx);

    const req = new Request('http://localhost:3000/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: demo.plan }),
    });

    const res = await handleConcepts(req, deps);
    expect(res.status).toBe(503);

    const text = await res.text();
    expect(text).not.toContain('sk-test-12345');
    expect(text).toContain('temporarily unavailable');
  });
});
