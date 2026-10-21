import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { err, ok } from '@/lib/result';
import { contingencyPercent, refreshContingency } from './budget';
import type { OpResult } from './patchOps';

export type BudgetOpType =
  'add_budget_item' | 'update_budget_item' | 'remove_budget_item' | 'scale_category';

export type BudgetPatchOp = Extract<PlanPatchOp, { type: BudgetOpType }>;

function handleScaleCategory(
  plan: EventPlan,
  category: string,
  percent: number,
  pct: number,
): OpResult {
  const notes: string[] = [];
  const updated = plan.budgetItems.map((item) => {
    if (item.category !== category || item.category === 'contingency') return item;
    if (item.locked) {
      notes.push(`${item.label} is locked and was not scaled.`);
      return item;
    }
    const multiplier = (100 + percent) / 100;
    return { ...item, unitCost: Math.round(item.unitCost * multiplier) };
  });
  const budgetItems = refreshContingency(updated, plan.meta.guestCount, pct);
  return ok({ plan: { ...plan, budgetItems }, notes });
}

/**
 * Reducer for budget item operations: adding, updating, removing, and category scaling.
 * WHY: Enforces strict item lock checks and refreshes contingency calculations.
 */
export function handleBudgetItemOps(plan: EventPlan, op: BudgetPatchOp): OpResult {
  const pct = contingencyPercent(plan.meta.type, plan.meta.setting);
  if (op.type === 'scale_category') {
    return handleScaleCategory(plan, op.category, op.percent, pct);
  }
  if (op.type === 'add_budget_item') {
    const raw = [...plan.budgetItems, op.item];
    return ok({
      plan: { ...plan, budgetItems: refreshContingency(raw, plan.meta.guestCount, pct) },
      notes: [],
    });
  }

  const item = plan.budgetItems.find((i) => i.id === op.id);
  if (!item) return err({ code: 'item_not_found', message: `Item ${op.id} not found` });

  const isUnlockOnly =
    op.type === 'update_budget_item' &&
    Object.keys(op.changes).length === 1 &&
    op.changes.locked === false;

  if (item.locked && !isUnlockOnly) {
    return err({ code: 'item_locked', message: `Item ${item.label} is locked` });
  }

  const nextItems =
    op.type === 'update_budget_item'
      ? plan.budgetItems.map((i) => (i.id === op.id ? { ...i, ...op.changes } : i))
      : plan.budgetItems.filter((i) => i.id !== op.id);

  return ok({
    plan: {
      ...plan,
      budgetItems: refreshContingency(nextItems, plan.meta.guestCount, pct),
    },
    notes: [],
  });
}
