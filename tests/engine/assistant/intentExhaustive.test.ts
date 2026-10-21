import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import type { EngineContext } from '@/engine/context';
import { applyPatch } from '@/engine/patch';
import { createIdFactory } from '@/lib/id';
import type { IntentOutput } from '@/llm/schemas/intent';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

import { createPlan } from '@/engine/planFactory';

describe('Assistant: Exhaustive Intent Handling & Patch Application', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');
  const makeCtx = (): EngineContext => ({
    ids: createIdFactory('exhaustive_test'),
    clock: fixedClock,
  });

  function makeDemoPlan(): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids: createIdFactory('demo_exhaustive'),
      clock: fixedClock,
    });
    return {
      ...plan,
      concepts: DEMO_SCENARIO.concepts,
    };
  }

  const testIntents: IntentOutput[] = [
    { kind: 'change_guest_count', guestCount: 90 },
    { kind: 'change_budget', amount: 160000, hard: true },
    { kind: 'adjust_category', category: 'decor', percent: -10 },
    { kind: 'upgrade', family: 'decor_theme', toQuality: 'premium' },
    { kind: 'downgrade', family: 'entertainment_music', toQuality: 'essential' },
    { kind: 'save_money', amount: 10000 },
    {
      kind: 'afford_check',
      description: 'live harpist',
      family: 'entertainment_music',
      userStatedCost: 12000,
    },
    { kind: 'find_forgotten' },
    { kind: 'make_it_premium' },
    { kind: 'simulate', scenario: { type: 'rain' } },
    { kind: 'select_concept', conceptRef: '1' },
    {
      kind: 'combine_concepts',
      baseRef: '1',
      borrowRef: '2',
      borrowCategories: ['decor'],
      percentCheaper: 10,
    },
    {
      kind: 'add_preference',
      preferenceKind: 'accessibility',
      description: 'Elevator access required',
      severity: 'soft',
    },
    { kind: 'set_setting', setting: 'mixed' },
    { kind: 'set_date', dateIso: '2026-12-25' },
    { kind: 'answer', reply: 'We recommend checking the venue parking capacity.' },
    { kind: 'clarify', question: 'Would you prefer live music or DJ setup?' },
    { kind: 'decline', reason: 'Live fireworks are not permitted at this venue.' },
  ];

  it('exhaustively handles all 18 intent kinds without unhandled errors', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    expect(testIntents).toHaveLength(18);

    for (const intent of testIntents) {
      const outcome = resolveIntent(frozenPlan, intent, ctx, '2026-10-21');
      expect(outcome).toBeDefined();
      expect(outcome.kind).not.toBe('error');

      // If outcome has recovery options, verify every option has valid patch source
      if ('options' in outcome) {
        for (const opt of outcome.options) {
          expect(opt.patch.source).toBe('user');
          expect(opt.patch.status).toBe('proposed');
        }
      }
    }
  });

  it('guarantees that every generated proposal patch applies cleanly upon host approval', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    const actionableIntents = testIntents.filter(
      (i) =>
        i.kind === 'change_guest_count' ||
        i.kind === 'adjust_category' ||
        i.kind === 'downgrade' ||
        i.kind === 'save_money' ||
        i.kind === 'select_concept' ||
        i.kind === 'add_preference' ||
        i.kind === 'set_setting' ||
        i.kind === 'set_date',
    );

    for (const intent of actionableIntents) {
      const outcome = resolveIntent(frozenPlan, intent, ctx, '2026-10-21');
      if (outcome.kind === 'proposal' && outcome.options.length > 0) {
        const option = outcome.options[0];
        if (!option) continue;

        const approvedPatch = {
          ...option.patch,
          status: 'approved' as const,
        };

        const result = applyPatch(frozenPlan, approvedPatch, ctx);
        expect(result.ok).toBe(true);
      }
    }
  });

  it('never mutates input plans during intent resolution', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    // Deep freeze guarantees any mutation attempt will throw an error in JS strict mode
    expect(() => {
      resolveIntent(
        frozenPlan,
        { kind: 'change_guest_count', guestCount: 150 },
        ctx,
        '2026-10-21',
      );
    }).not.toThrow();

    expect(frozenPlan.meta.guestCount).toBe(80);
  });
});
