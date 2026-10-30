import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { ok } from '@/lib/result';
import type { LLMProvider } from '@/llm/types';
import { createDeps } from '@/server/deps';
import { handleMessage } from '@/server/handlers/message';

const clock = () => new Date('2026-10-21T12:00:00.000Z');

function demoPlan(): EventPlan {
  const { plan } = createPlan({
    meta: DEMO_SCENARIO.meta,
    constraints: DEMO_SCENARIO.constraints,
    ids: createIdFactory('msg_steps'),
    clock,
  });
  return { ...plan, concepts: DEMO_SCENARIO.concepts };
}

function post(message: string, plan: EventPlan): Request {
  return new Request('http://localhost:3000/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, plan }),
  });
}

describe('Server: compound chat requests', () => {
  it('turns a two-part message into one proposal with a step list (demo mode)', async () => {
    const plan = demoPlan();
    const res = await handleMessage(post('Add 20 more guests and what if it rains', plan), createDeps({ mode: 'demo', clock }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.outcome.kind).toBe('proposal');
    expect(json.outcome.options).toHaveLength(1);
    expect(json.outcome.steps).toHaveLength(2);
    expect(json.outcome.steps[0].label).toBe(`Change the guest count to ${plan.meta.guestCount + 20}`);
    expect(json.outcome.options[0].patch.status).toBe('proposed');
  });

  it('accepts a live model returning steps and resolves them through the engine', async () => {
    const live: LLMProvider = {
      name: 'live-steps',
      async complete() {
        return ok(
          JSON.stringify({
            steps: [
              { kind: 'change_guest_count', guestCount: 100 },
              { kind: 'change_guest_count', guestCount: 120 },
            ],
          }),
        );
      },
    };
    const res = await handleMessage(post('100 guests, actually 120', demoPlan()), createDeps({ provider: live, mode: 'live', clock }));
    const json = await res.json();
    expect(json.degraded).toBe(false);
    expect(json.outcome.kind).toBe('clarify');
    expect(json.outcome.question).toMatch(/100.*120/);
  });
});
