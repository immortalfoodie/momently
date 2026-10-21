import { familyForText } from '@/data/familyKeywords';
import { getTemplate } from '@/data/templates';
import type {
  BudgetItem,
  EventPlan,
  EventType,
  PlanPatchOp,
  Task,
  VendorNeed,
} from '@/domain/types';
import type { EngineContext } from '@/engine/context';

export function findMatchingVendor(
  plan: EventPlan,
  categoryQuery: string,
): VendorNeed | undefined {
  const queryLower = categoryQuery.toLowerCase().trim();
  const directMatch = plan.vendors.find((v) => v.category.toLowerCase() === queryLower);
  if (directMatch) return directMatch;

  const queryFamily = familyForText(categoryQuery);
  if (queryFamily) {
    return plan.vendors.find(
      (v) =>
        v.category.toLowerCase() === queryFamily ||
        familyForText(v.category) === queryFamily,
    );
  }
  return undefined;
}

export function findMatchingItem(
  plan: EventPlan,
  vendor: VendorNeed,
): BudgetItem | undefined {
  return plan.budgetItems.find(
    (i) =>
      i.category.toLowerCase() === vendor.category.toLowerCase() ||
      (i.rateKey && familyForText(i.rateKey) === familyForText(vendor.category)),
  );
}

export function buildRecoveryTasks(
  vendor: VendorNeed,
  daysAway: number,
  ctx: EngineContext,
): Task[] {
  const isUrgent = daysAway < 7;
  const priority = isUrgent ? ('high' as const) : ('medium' as const);

  return [
    {
      id: ctx.ids('task'),
      title: `Shortlist 3 replacement vendors for ${vendor.category}`,
      category: vendor.category,
      priority,
      dueDaysBefore: isUrgent ? Math.max(1, daysAway - 1) : Math.min(daysAway, 21),
      status: 'todo',
    },
    {
      id: ctx.ids('task'),
      title: `Request quotes against original brief for ${vendor.category}`,
      category: vendor.category,
      priority,
      dueDaysBefore: isUrgent ? Math.max(1, daysAway - 2) : Math.min(daysAway, 14),
      status: 'todo',
    },
    {
      id: ctx.ids('task'),
      title: `Confirm replacement and pay deposit only after checks for ${vendor.category}`,
      category: vendor.category,
      priority,
      dueDaysBefore: isUrgent ? 1 : Math.min(daysAway, 7),
      status: 'todo',
    },
  ];
}

export function buildCancelItemOps(matchingItem?: BudgetItem): PlanPatchOp[] {
  if (!matchingItem) return [];
  const ops: PlanPatchOp[] = [];
  if (matchingItem.locked) {
    ops.push({
      type: 'update_budget_item',
      id: matchingItem.id,
      changes: { locked: false },
    });
  }
  ops.push({
    type: 'update_budget_item',
    id: matchingItem.id,
    changes: { provenance: 'estimate', note: 'Vendor cancelled - requote' },
  });
  return ops;
}

export function buildCriteriaNotes(
  vendor: VendorNeed,
  eventType: EventType,
  daysAway: number,
): string[] {
  const template = getTemplate(eventType);
  const tplNeed = template.vendors.find((n) => n.category === vendor.category);
  const notes = [
    `Replacement criteria: requirements: ${vendor.requirements.join(', ') || 'standard'}.`,
    `Questions to ask: ${(tplNeed?.questionsToAsk ?? vendor.questionsToAsk).join('; ') || 'check portfolio and contract terms'}.`,
  ];
  if (daysAway < 7) {
    notes.push(
      `Urgent timeline: only ${daysAway} days remaining; replacement expedited with top priority.`,
    );
  }
  return notes;
}
