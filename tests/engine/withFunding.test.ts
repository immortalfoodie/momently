import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { BudgetItem } from '@/domain/types';
import { withFunding } from '@/engine/assistant/withFunding';
import { buildOption } from '@/engine/chaos/option';
import { buildDemoPlan } from '@/engine/demo';
import { suggestSavings } from '@/engine/guardian';
import { createPlan } from '@/engine/planFactory';
import { deepFreeze } from '../helpers/deepFreeze';

describe('Pure Engine: withFunding', () => {
  const fixedClock = () => new Date('2026-10-22T10:00:00.000Z');
  let idCount = 0;
  const ids = (p?: string) => `${p ?? 'id'}_${++idCount}`;
  const ctx = { ids, clock: fixedClock };

  it('combines option and savings strategy so funded option meets budget cap', () => {
    const base = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: [],
      ids,
      clock: fixedClock,
      quality: 'standard',
    }).plan;
    const initialTotal = base.budgetItems.reduce(
      (sum, item) =>
        sum + (item.basis === 'per_guest' ? item.unitCost * base.meta.guestCount : item.unitCost * item.quantity),
      0,
    );

    const plan = deepFreeze({
      ...base,
      constraints: [
        {
          id: 'c_cap',
          kind: 'budget_cap' as const,
          severity: 'hard' as const,
          numericValue: initialTotal,
          description: 'Exact budget cap',
        },
      ],
    });

    // Add an item costing ₹15,000 pushing budget over cap by a recoverable deficit
    const expensiveItem: BudgetItem = {
      id: 'item_drone_cinematography',
      label: 'Drone Cinematic Film',
      category: 'photography',
      basis: 'flat',
      unitCost: 15000,
      quantity: 1,
      provenance: 'user',
      locked: false,
    };

    const expensiveOption = buildOption(
      plan,
      [{ type: 'add_budget_item', item: expensiveItem }],
      { id: 'opt_drone', label: 'Add Drone Cinema', tradeoff: 'Premium cost addition' },
      ctx,
    );

    expect(expensiveOption).toBeDefined();
    expect(expensiveOption!.meetsCap).toBe(false);

    // Guardian suggests savings strategies for the deficit
    const overBy = expensiveOption!.impact.budgetTotalAfter - initialTotal;
    const savingsStrategies = suggestSavings(plan, overBy, {}, ctx);
    const strategy = savingsStrategies.find((s) => s.met);
    expect(strategy).toBeDefined();
    if (!strategy) return;
    deepFreeze(expensiveOption!);
    deepFreeze(strategy);

    const fundedResult = withFunding(plan, expensiveOption!, strategy, ctx);
    expect(fundedResult.ok).toBe(true);

    if (fundedResult.ok) {
      const fundedOption = fundedResult.value;
      expect(fundedOption.label).toBe(
        `Add Drone Cinema + funded by: ${strategy.label}`,
      );
      expect(fundedOption.meetsCap).toBe(true);
      expect(fundedOption.impact.budgetTotalAfter).toBeLessThanOrEqual(initialTotal);
      expect(fundedOption.patch.status).toBe('proposed');
      expect(fundedOption.approvalsRequired.length).toBeGreaterThan(0);
    }
  });

  it('drops earlier ops when later savings strategy ops target the same item', () => {
    const demo = buildDemoPlan(ctx);
    const targetItem = demo.plan.budgetItems[0]!;

    const option = buildOption(
      demo.plan,
      [
        {
          type: 'update_budget_item',
          id: targetItem.id,
          changes: { unitCost: 30000 },
        },
      ],
      { id: 'opt_initial', label: 'Initial upgrade', tradeoff: 'More expensive' },
      ctx,
    )!;

    const mockStrategy = {
      id: 'strat_override',
      label: 'Downgrade Target Item',
      target: 10000,
      achieved: 15000,
      met: true,
      shortfall: 0,
      levers: [],
      ops: [
        {
          type: 'update_budget_item' as const,
          id: targetItem.id,
          changes: { unitCost: 12000 },
        },
      ],
    };

    const funded = withFunding(demo.plan, option, mockStrategy, ctx);
    expect(funded.ok).toBe(true);

    if (funded.ok) {
      // Exactly one op targeting targetItem, and its unitCost is 12000
      const itemOps = funded.value.patch.ops.filter(
        (op) => op.type === 'update_budget_item' && op.id === targetItem.id,
      );
      expect(itemOps).toHaveLength(1);
      const winningOp = itemOps[0];
      if (winningOp && winningOp.type === 'update_budget_item') {
        expect(winningOp.changes.unitCost).toBe(12000);
      }
    }
  });
});
