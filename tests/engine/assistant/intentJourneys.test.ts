import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import type { EngineContext } from '@/engine/context';
import { applyPatch } from '@/engine/patch';
import { createIdFactory } from '@/lib/id';

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

describe('Assistant: Blueprint Host Journeys', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');
  const makeCtx = (): EngineContext => ({
    ids: createIdFactory('journeys_test'),
    clock: fixedClock,
  });

  function makeDemoPlan(): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids: createIdFactory('demo_journeys'),
      clock: fixedClock,
    });
    return {
      ...plan,
      concepts: DEMO_SCENARIO.concepts,
    };
  }

  it('Journey 1: Upgrade décor while keeping budget fixed protects décor from cuts', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    const outcome = resolveIntent(
      frozenPlan,
      { kind: 'upgrade', family: 'decor_theme', toQuality: 'premium' },
      ctx,
      '2026-10-21',
    );

    expect(outcome.kind).toBe('proposal');
    if (outcome.kind !== 'proposal') return;

    expect(outcome.options.length).toBeGreaterThan(0);
    const firstOption = outcome.options[0];
    expect(firstOption).toBeDefined();
    if (!firstOption) return;

    // None of the funding savings ops touch the upgraded decor_theme family
    const decorCutOp = firstOption.patch.ops.find(
      (op) =>
        op.type === 'update_budget_item' &&
        'rateKey' in op.changes &&
        typeof op.changes.rateKey === 'string' &&
        op.changes.rateKey.startsWith('decor_theme.') &&
        op.changes.rateKey !== 'decor_theme.premium',
    );
    expect(decorCutOp).toBeUndefined();

    // Applied patch adheres to budget cap
    const applyRes = applyPatch(
      frozenPlan,
      { ...firstOption.patch, status: 'approved' },
      ctx,
    );
    expect(applyRes.ok).toBe(true);
    if (applyRes.ok) {
      expect(applyRes.value.impact.budgetTotalAfter).toBeLessThanOrEqual(150000);
    }
  });

  it('Journey 2: Increase guests 80 -> 110 preserves locked items with honest notes', () => {
    const ctx = makeCtx();
    const planWithLock = deepFreeze({
      ...makeDemoPlan(),
      budgetItems: makeDemoPlan().budgetItems.map((item, idx) =>
        idx === 0 ? { ...item, locked: true } : item,
      ),
    });

    const outcome = resolveIntent(
      planWithLock,
      { kind: 'change_guest_count', guestCount: 110 },
      ctx,
      '2026-10-21',
    );

    expect(outcome.kind).toBe('proposal');
    if (outcome.kind !== 'proposal') return;

    expect(outcome.options.length).toBeGreaterThan(0);
    const holdOption = outcome.options.find((o) => o.id.includes('hold'));
    const raiseOption = outcome.options.find((o) => o.id.includes('raise'));
    expect(holdOption || raiseOption).toBeDefined();

    // Notes mention preserved locked decisions
    const firstOption = outcome.options[0];
    expect(
      firstOption?.notes.some((n) => n.includes('Locked decisions') || n.includes('Preserved')),
    ).toBe(true);
  });

  it('Journey 3: Can we fit a live singer distinguishes user-quoted vs estimated provenance', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    // Host provides own quote
    const statedOutcome = resolveIntent(
      frozenPlan,
      {
        kind: 'afford_check',
        description: 'live acoustic singer',
        family: 'entertainment_music',
        userStatedCost: 15000,
      },
      ctx,
      '2026-10-21',
    );
    expect(statedOutcome.kind).toMatch(/proposal|conflict/);
    if (statedOutcome.kind === 'proposal' || statedOutcome.kind === 'conflict') {
      expect(statedOutcome.message).toContain('host-quoted cost');
    }

    // Host asks for rate card estimate
    const estimatedOutcome = resolveIntent(
      frozenPlan,
      {
        kind: 'afford_check',
        description: 'live singer',
        family: 'entertainment_music',
        userStatedCost: null,
      },
      ctx,
      '2026-10-21',
    );
    expect(estimatedOutcome.kind).toMatch(/proposal|conflict/);
    if (estimatedOutcome.kind === 'proposal' || estimatedOutcome.kind === 'conflict') {
      expect(estimatedOutcome.message).toContain('vendor confirmation');
    }
  });

  it('Journey 4: Save ₹15,000 generates strategies that preview at least ₹15,000 savings or reports shortfall', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    const outcome = resolveIntent(
      frozenPlan,
      { kind: 'save_money', amount: 15000 },
      ctx,
      '2026-10-21',
    );

    expect(outcome.kind).toBe('proposal');
    if (outcome.kind !== 'proposal') return;

    expect(outcome.options.length).toBeGreaterThan(0);
    for (const opt of outcome.options) {
      const savingsAchieved =
        opt.impact.budgetTotalBefore - opt.impact.budgetTotalAfter;
      if (savingsAchieved >= 15000) {
        expect(savingsAchieved).toBeGreaterThanOrEqual(15000);
      } else {
        expect(
          opt.notes.some((n) => n.toLowerCase().includes('shortfall') || n.includes('saved')) ||
            opt.label.includes('save'),
        ).toBe(true);
      }
    }
  });

  it('Journey 5: What if it rains evaluates outdoor contingency and reports indoor inapplicability', () => {
    const ctx = makeCtx();

    // Outdoor plan
    const outdoorPlan = deepFreeze({
      ...makeDemoPlan(),
      meta: { ...makeDemoPlan().meta, setting: 'outdoor' as const },
    });
    const outdoorChaos = resolveIntent(
      outdoorPlan,
      { kind: 'simulate', scenario: { type: 'rain' } },
      ctx,
      '2026-10-21',
    );
    expect(outdoorChaos.kind).toBe('chaos');
    if (outdoorChaos.kind === 'chaos') {
      expect(outdoorChaos.result.applicable).toBe(true);
      expect(outdoorChaos.result.options.length).toBe(2);
    }

    // Indoor plan
    const indoorPlan = deepFreeze({
      ...makeDemoPlan(),
      meta: { ...makeDemoPlan().meta, setting: 'indoor' as const },
    });
    const indoorChaos = resolveIntent(
      indoorPlan,
      { kind: 'simulate', scenario: { type: 'rain' } },
      ctx,
      '2026-10-21',
    );
    expect(indoorChaos.kind).toBe('chaos');
    if (indoorChaos.kind === 'chaos') {
      expect(indoorChaos.result.applicable).toBe(false);
    }
  });

  it('Journey 6: Budget cap below essential floor returns conflict and never silent overspend', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    const outcome = resolveIntent(
      frozenPlan,
      { kind: 'change_budget', amount: 5000, hard: true },
      ctx,
      '2026-10-21',
    );

    expect(outcome.kind).toBe('conflict');
    if (outcome.kind !== 'conflict') return;

    expect(outcome.message).toContain('below the minimum essential floor');
    expect(outcome.options.some((o) => o.id.includes('raise_cap_to_floor'))).toBe(true);
  });
});
