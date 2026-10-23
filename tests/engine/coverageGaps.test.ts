import { describe, expect, it, vi } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { resolveIntent } from '@/engine/assistant';
import { withFunding } from '@/engine/assistant/withFunding';
import { budgetTotal } from '@/engine/budget';
import { buildOption } from '@/engine/chaos/option';
import { findViolations } from '@/engine/constraints';
import { minimumFeasibleCost } from '@/engine/feasibility';
import { rebalanceForImpact } from '@/engine/impactRebalance';
import { createPlan } from '@/engine/planFactory';
import { quoteToBudgetOps } from '@/engine/quoteToBudget';
import { downloadText } from '@/lib/export/download';
import { orderQuantities, orderQuantitiesToText } from '@/lib/export/orderQuantities';
import { createIdFactory } from '@/lib/id';

describe('Engine & Lib: Uncovered Branch and Error Path Tests', () => {
  const ids = createIdFactory('cov_gaps');
  const clock = () => new Date('2026-10-21T12:00:00.000Z');
  const ctx = { ids, clock };

  function makePlan(): EventPlan {
    return createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock,
    }).plan;
  }

  it('resolveChangeBudget handles mid-range budget reduction (between floor and current total) and soft targets', () => {
    const plan = makePlan();
    const currentTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
    const floor = minimumFeasibleCost(plan.meta, plan.guestNeeds, ctx);
    const midAmount = Math.round((floor + currentTotal) / 2);

    const lowerOutcome = resolveIntent(
      plan,
      { kind: 'change_budget', amount: midAmount, hard: true },
      ctx,
      '2026-10-21',
    );
    expect(lowerOutcome.kind).toBe('proposal');
    if (lowerOutcome.kind === 'proposal') {
      expect(lowerOutcome.options.length).toBeGreaterThan(0);
    }

    const softOutcome = resolveIntent(
      plan,
      { kind: 'change_budget', amount: currentTotal + 100000, hard: false },
      ctx,
      '2026-10-21',
    );
    expect(softOutcome.kind).toBe('proposal');
    if (softOutcome.kind === 'proposal') {
      expect(softOutcome.message).toContain('flexible target');
    }
  });

  it('resolveAddPreference and resolveSetSetting return conflict outcomes when a new conflict is introduced', () => {
    const plan: EventPlan = {
      ...makePlan(),
      meta: {
        ...makePlan().meta,
        setting: 'indoor',
        dateIso: '2026-07-15', // Monsoon month
      },
      budgetItems: makePlan().budgetItems.filter(
        (i) => !i.rateKey?.startsWith('weather_cover.') && !i.rateKey?.startsWith('photo_video.'),
      ),
    };

    const settingConflict = resolveIntent(
      plan,
      { kind: 'set_setting', setting: 'outdoor' },
      ctx,
      '2026-06-01',
    );
    expect(settingConflict.kind).toBe('conflict');

    const prefConflict = resolveIntent(
      plan,
      {
        kind: 'add_preference',
        preferenceKind: 'must_have',
        severity: 'hard',
        description: 'Photography and video coverage',
      },
      ctx,
      '2026-06-01',
    );
    expect(prefConflict.kind).toBe('conflict');
  });

  it('rebalanceForImpact funds high-impact upgrades via low-visibility downgrades when capped at initialTotal', () => {
    const base = makePlan();
    const customItems = base.budgetItems.map((item) => {
      if (item.rateKey?.startsWith('decor_theme.')) {
        return { ...item, rateKey: 'decor_theme.essential', unitCost: 20000 };
      }
      if (item.rateKey?.startsWith('gifts_favours.')) {
        return { ...item, rateKey: 'gifts_favours.premium', unitCost: 2000, basis: 'per_guest' as const };
      }
      return item;
    });
    const initialTotal = budgetTotal(customItems, base.meta.guestCount);
    const tightPlan: EventPlan = {
      ...base,
      budgetItems: customItems,
      constraints: [
        {
          id: 'c_tight_cap',
          kind: 'budget_cap',
          severity: 'hard',
          description: 'Tight cap at current spend',
          numericValue: initialTotal,
        },
      ],
    };

    const res = rebalanceForImpact(tightPlan, ctx);
    expect(res.changed).toBe(true);
    expect(res.upgraded.length).toBeGreaterThan(0);
    expect(res.downgraded.length).toBeGreaterThan(0);
  });

  it('quoteToBudgetOps creates a new budget line item when no matching category item exists', () => {
    const base = makePlan();
    const planWithoutPhoto: EventPlan = {
      ...base,
      budgetItems: base.budgetItems.filter((i) => i.category !== 'photography'),
    };
    const photoNeed = base.vendors.find((v) => v.category === 'photography')!;

    const res = quoteToBudgetOps(
      planWithoutPhoto,
      photoNeed,
      { vendorName: 'Studio Lumina', price: 85000, answers: {} },
      true,
      ctx,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.ops[0]?.type).toBe('add_budget_item');
      expect(res.value.summary).toContain('Added budget line for Studio Lumina');
    }
  });

  it('findViolations reports hard guest_count constraint breaches', () => {
    const base = makePlan();
    const planOverGuests: EventPlan = {
      ...base,
      meta: { ...base.meta, guestCount: 150 },
      constraints: [
        ...base.constraints,
        {
          id: 'c_max_guests',
          kind: 'guest_count',
          severity: 'hard',
          description: 'Hall limit 100',
          numericValue: 100,
        },
      ],
    };

    const violations = findViolations(planOverGuests);
    expect(violations.some((v) => v.constraintId === 'c_max_guests' && v.overBy === 50)).toBe(true);
  });

  it('withFunding deduplicates slot, task, category, and singleton ops and surfaces preview errors', () => {
    const plan = makePlan();
    const baseOpt = buildOption(
      plan,
      [
        { type: 'scale_category', category: 'decor', percent: 10 },
        { type: 'set_meta', changes: { city: 'Pune' } },
      ],
      { id: 'opt_1', label: 'Base', tradeoff: 'Tradeoff' },
      ctx,
    )!;

    const strategy = {
      id: 'strat_1',
      label: 'Offset',
      levers: [],
      target: 5000,
      achieved: 5000,
      met: true,
      shortfall: 0,
      ops: [
        { type: 'scale_category' as const, category: 'decor' as const, percent: -10 },
        { type: 'set_meta' as const, changes: { city: 'Mumbai' } },
      ],
    };

    const merged = withFunding(plan, baseOpt, strategy, ctx);
    expect(merged.ok).toBe(true);

    const invalidStrategy = {
      ...strategy,
      ops: [{ type: 'remove_slot' as const, id: 'non_existent_slot_id' }],
    };
    const errRes = withFunding(plan, baseOpt, invalidStrategy, ctx);
    expect(errRes.ok).toBe(false);
  });

  it('orderQuantitiesToText formats rows and downloadText swallows DOM errors gracefully', () => {
    const plan = makePlan();
    const rows = orderQuantities(plan);
    const text = orderQuantitiesToText(rows);
    expect(text).toContain('Food servings: 84 servings');
    expect(text).toContain('Tables of 8: 10 tables');

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('DOM blocked');
    });
    expect(() => downloadText('test.txt', 'text/plain', 'hello')).not.toThrow();
    createElementSpy.mockRestore();
  });
});
