import type { BudgetItem, EventPlan, Money, PlanImpact } from '@/domain/types';
import { budgetTotal, getBudgetCap, itemTotal } from './budget';

interface ItemCostEntry {
  label: string;
  cost: Money;
}

function buildItemCostMap(
  items: BudgetItem[],
  guestCount: number,
): Map<string, ItemCostEntry> {
  const map = new Map<string, ItemCostEntry>();
  for (const item of items) {
    map.set(item.id, {
      label: item.label,
      cost: itemTotal(item, guestCount),
    });
  }
  return map;
}

function diffItemMaps(
  beforeMap: Map<string, ItemCostEntry>,
  afterMap: Map<string, ItemCostEntry>,
): Array<{ label: string; before: Money; after: Money }> {
  const changed: Array<{ label: string; before: Money; after: Money }> = [];
  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const id of allIds) {
    const prev = beforeMap.get(id);
    const curr = afterMap.get(id);
    const beforeCost = prev ? prev.cost : 0;
    const afterCost = curr ? curr.cost : 0;

    if (beforeCost !== afterCost) {
      const label = curr ? curr.label : prev ? prev.label : id;
      changed.push({
        label,
        before: beforeCost,
        after: afterCost,
      });
    }
  }

  return changed;
}

/**
 * Purely computes the differential impact of modifications between two versions of an EventPlan.
 * WHY: Generates structured diffs enabling review dialogs to explain cost and schedule ramifications
 * to hosts before patch approval.
 *
 * @param before - The original EventPlan state.
 * @param after - The proposed or modified EventPlan state.
 * @param notes - Operational and audit notes generated during patch execution.
 * @returns Comprehensive PlanImpact record.
 */
export function computeImpact(
  before: EventPlan,
  after: EventPlan,
  notes: string[],
): PlanImpact {
  const budgetTotalBefore = budgetTotal(before.budgetItems, before.meta.guestCount);
  const budgetTotalAfter = budgetTotal(after.budgetItems, after.meta.guestCount);
  const budgetCap = getBudgetCap(after.constraints);
  const overCap = budgetCap !== null && budgetTotalAfter > budgetCap;

  const beforeMap = buildItemCostMap(before.budgetItems, before.meta.guestCount);
  const afterMap = buildItemCostMap(after.budgetItems, after.meta.guestCount);
  const changedItems = diffItemMaps(beforeMap, afterMap);

  return {
    budgetTotalBefore,
    budgetTotalAfter,
    budgetCap,
    overCap,
    changedItems,
    notes,
  };
}
