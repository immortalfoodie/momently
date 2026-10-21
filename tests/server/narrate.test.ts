import { describe, expect, it } from 'vitest';
import type { LLMProvider } from '@/llm/types';
import { createDeps } from '@/server/deps';
import { handleNarrate } from '@/server/handlers/narrate';

describe('Server: Narrate Handler', () => {
  it('generates grounded narrative and highlights from verified facts', async () => {
    const deps = createDeps({ mode: 'demo' });
    const req = new Request('http://localhost:3000/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: 'budget_explainer',
        facts: {
          concept_name: 'Golden Bollywood Elegance',
          total_cost: 145000,
          guest_count: 80,
          venue_style: 'Banquet Hall',
        },
      }),
    });

    const res = await handleNarrate(req, deps);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(typeof json.text).toBe('string');
    expect(json.text.length).toBeGreaterThan(0);
    expect(Array.isArray(json.highlights)).toBe(true);
    expect(json.degraded).toBe(false);
  });

  it('rejects invalid narrate payloads with 400', async () => {
    const deps = createDeps();

    // 1. Invalid purpose
    const reqInvalid = new Request('http://localhost:3000/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: 'non_existent_purpose',
        facts: { key: 'value' },
      }),
    });
    const resInvalid = await handleNarrate(reqInvalid, deps);
    expect(resInvalid.status).toBe(400);

    // 2. Overly large facts map (> 30 entries)
    const tooManyFacts: Record<string, string> = {};
    for (let i = 0; i < 35; i++) {
      tooManyFacts[`fact_${i}`] = `value_${i}`;
    }
    const reqLargeFacts = new Request('http://localhost:3000/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: 'budget_explainer',
        facts: tooManyFacts,
      }),
    });
    const resLargeFacts = await handleNarrate(reqLargeFacts, deps);
    expect(resLargeFacts.status).toBe(400);
  });

  it('returns 503 ai_unavailable when narrate task fails even after fallback', async () => {
    const failingProvider: LLMProvider = {
      name: 'always-failing',
      async complete() {
        return {
          ok: false,
          error: {
            code: 'provider_unavailable',
            message: 'All narrative models offline',
            retryable: false,
          },
        };
      },
    };

    const deps = createDeps({
      provider: failingProvider,
      mockProvider: failingProvider,
    });

    const req = new Request('http://localhost:3000/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose: 'budget_explainer',
        facts: { headline: 'Test headline' },
      }),
    });

    const res = await handleNarrate(req, deps);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe('ai_unavailable');
  });
});
