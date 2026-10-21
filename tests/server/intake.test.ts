import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { err } from '@/lib/result';
import type { LlmRequest, LLMProvider } from '@/llm/types';
import { createDeps } from '@/server/deps';
import { handleIntake } from '@/server/handlers/intake';

describe('Server: Intake Handler', () => {
  it('synthesizes a fitting plan with 3 concepts from benchmark demo brief', async () => {
    const deps = createDeps({ mode: 'demo' });
    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: DEMO_SCENARIO.hostBrief }),
    });

    const res = await handleIntake(req, deps);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.plan).toBeDefined();
    expect(json.plan.meta.guestCount).toBe(80);
    expect(json.plan.meta.city).toBe('Mumbai');
    expect(json.plan.meta.hostBrief).toBe(DEMO_SCENARIO.hostBrief);
    expect(json.plan.concepts).toHaveLength(3);
    expect(json.fit.fits).toBe(true);
    expect(json.mode).toBe('demo');
    expect(json.degraded).toBe(false);
  });

  it('rejects empty or overly long intake text with 400', async () => {
    const deps = createDeps();

    // 1. Empty string
    const reqEmpty = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });
    const resEmpty = await handleIntake(reqEmpty, deps);
    expect(resEmpty.status).toBe(400);

    // 2. Text > 1500 chars
    const reqLong = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'A'.repeat(1600) }),
    });
    const resLong = await handleIntake(reqLong, deps);
    expect(resLong.status).toBe(400);
  });

  it('degrades to mock provider when primary provider fails with network/timeout error', async () => {
    const failingPrimary: LLMProvider = {
      name: 'failing-gemini',
      async complete() {
        return err({
          code: 'provider_unavailable',
          message: 'Upstream gateway timeout',
          retryable: true,
        });
      },
    };

    const deps = createDeps({
      provider: failingPrimary,
      mode: 'live',
    });

    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: DEMO_SCENARIO.hostBrief }),
    });

    const res = await handleIntake(req, deps);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.plan).toBeDefined();
    expect(json.degraded).toBe(true);
  });

  it('returns valid plan without concepts and records a note when concept synthesis fails', async () => {
    // Provider where intake succeeds but concepts fails
    const mockDefault = createDeps().mockProvider;
    const partialFailureProvider: LLMProvider = {
      name: 'partial-fail',
      async complete(req: LlmRequest) {
        if (req.task === 'concepts') {
          return err({
            code: 'provider_unavailable',
            message: 'Concept generator overloaded',
            retryable: false,
          });
        }
        return mockDefault.complete(req);
      },
    };

    // Both primary and mock fail on concepts
    const deps = createDeps({
      provider: partialFailureProvider,
      mockProvider: partialFailureProvider,
      mode: 'demo',
    });

    const req = new Request('http://localhost:3000/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: DEMO_SCENARIO.hostBrief }),
    });

    const res = await handleIntake(req, deps);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.plan).toBeDefined();
    expect(json.plan.concepts).toHaveLength(0);
    expect(json.notes.some((n: string) => n.includes('Concepts could not be generated'))).toBe(true);
  });
});
