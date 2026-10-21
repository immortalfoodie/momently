import { getTemplate } from '@/data/templates';
import { BUDGET_CATEGORY_IDS } from '@/domain/constants';
import type { BudgetItem, EventPlan, QualityLevel } from '@/domain/types';
import type { PlanSummary } from './schemas/context';

export * from './schemas/context';

export interface SummarizePlanOptions {
  maxChars?: number;
}

function parseFamilyAndQuality(item: BudgetItem): { family: string; quality: QualityLevel | null } {
  if (item.rateKey && item.rateKey.includes('.')) {
    const [f, q] = item.rateKey.split('.');
    const quality = q === 'essential' || q === 'standard' || q === 'premium' ? q : null;
    return { family: f || item.id, quality };
  }
  return { family: item.id, quality: null };
}

function shedBudgetItems(summary: PlanSummary, maxChars: number): void {
  summary.truncated = true;
  const sorted = [...summary.budgetItems].sort((a, b) => a.total - b.total);
  while (sorted.length > 0 && JSON.stringify(summary).length > maxChars) {
    const dropped = sorted.shift();
    if (dropped) {
      summary.budgetItems = summary.budgetItems.filter((it) => it.id !== dropped.id);
    }
  }
}

/**
 * Distills an EventPlan into a compact, deterministic, JSON-safe summary tailored for LLM prompts.
 * WHY: Enforces strict context budget (~6000 chars), prevents guest PII leakage, and exposes only
 * what is necessary for intelligent intent classification and concept generation.
 *
 * @param plan - The active EventPlan domain entity.
 * @param options - Optional sizing limits (defaults to ~6000 chars).
 * @returns Validated, compact PlanSummary.
 */
export function summarizePlanForLlm(
  plan: EventPlan,
  options?: SummarizePlanOptions,
): PlanSummary {
  const maxChars = options?.maxChars ?? 6000;
  const template = getTemplate(plan.meta.type);
  const allowedFamilies = template.lineItems.map((item) => item.family);
  const allowedCategories = [...BUDGET_CATEGORY_IDS];

  const capConstraint = plan.constraints.find(
    (c) => c.kind === 'budget_cap' && c.severity === 'hard',
  );
  const cap = capConstraint?.numericValue ?? null;

  const totalsByCategory: Record<string, number> = {};
  for (const cat of allowedCategories) {
    totalsByCategory[cat] = 0;
  }

  let grandTotal = 0;
  const budgetItems = plan.budgetItems.map((item) => {
    const total = item.unitCost * item.quantity;
    grandTotal += total;
    totalsByCategory[item.category] = (totalsByCategory[item.category] ?? 0) + total;
    const { family, quality } = parseFamilyAndQuality(item);

    return {
      id: item.id,
      label: item.label,
      category: item.category,
      family,
      quality,
      total,
      provenance: item.provenance,
      locked: item.locked,
    };
  });

  const remaining = cap !== null ? cap - grandTotal : null;
  const overCap = cap !== null ? grandTotal > cap : false;

  const summary: PlanSummary = {
    meta: {
      title: plan.meta.title,
      type: plan.meta.type,
      city: plan.meta.city,
      dateIso: plan.meta.dateIso,
      guestCount: plan.meta.guestCount,
      setting: plan.meta.setting,
      hostBrief: plan.meta.hostBrief.slice(0, 300),
    },
    hardConstraints: plan.constraints
      .filter((c) => c.severity === 'hard')
      .map((c) => c.description),
    softConstraints: plan.constraints
      .filter((c) => c.severity === 'soft')
      .map((c) => c.description),
    concepts: plan.concepts.slice(0, 3).map((c, i) => ({
      index: (i + 1) as 1 | 2 | 3,
      title: c.title,
      qualityProfile: c.qualityProfile ?? {},
    })),
    selectedConceptId: plan.selectedConceptId,
    budgetItems,
    totalsByCategory,
    budgetStatus: { cap, total: grandTotal, remaining, overCap },
    schedule: plan.schedule.map((s) => ({
      id: s.id,
      title: s.title,
      startMinute: s.startMinute,
      durationMinutes: s.durationMinutes,
      priority: s.priority,
    })),
    vendors: plan.vendors.map((v) => ({ category: v.category, status: v.status })),
    guestNeeds: {
      vegetarian: plan.guestNeeds.vegetarian,
      jain: plan.guestNeeds.jain,
      vegan: plan.guestNeeds.vegan,
      glutenFree: plan.guestNeeds.glutenFree,
      allergyAlerts: plan.guestNeeds.allergyAlerts,
      wheelchairUsers: plan.guestNeeds.wheelchairUsers,
      elderly: plan.guestNeeds.elderly,
      children: plan.guestNeeds.children,
      quietSpaceNeeded: plan.guestNeeds.quietSpaceNeeded,
      languages: [...plan.guestNeeds.languages],
    },
    allowedFamilies,
    allowedCategories,
    truncated: false,
  };

  if (JSON.stringify(summary).length > maxChars) {
    shedBudgetItems(summary, maxChars);
  }

  return summary;
}
