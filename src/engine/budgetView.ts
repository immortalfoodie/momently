import { BUDGET_CATEGORIES, BUDGET_CATEGORY_IDS } from '@/domain/constants';
import type {
  BudgetCategory,
  BudgetItem,
  EventPlan,
  Money,
  PlanImpact,
  Provenance,
} from '@/domain/types';
import { budgetTotal, getBudgetCap, itemTotal } from './budget';
import type { Conflict } from './conflicts';
import { findConflicts } from './conflicts';
import type { EngineContext } from './context';
import type { GuestMetrics } from './guestMetrics';
import { deriveGuestMetrics } from './guestMetrics';
import { computeImpact } from './impact';
import type { PatchError } from './patch';
import { previewOps } from './preview';

export interface BudgetCategoryItemView {
  item: BudgetItem;
  total: Money;
}

export interface BudgetCategoryView {
  category: BudgetCategory;
  label: string;
  total: Money;
  sharePercent: number;
  items: BudgetCategoryItemView[];
}

export interface ProvenanceView {
  provenance: Provenance;
  total: Money;
  sharePercent: number;
}

export interface BudgetView {
  total: Money;
  cap: Money | null;
  remaining: Money;
  overCap: boolean;
  categories: BudgetCategoryView[];
  provenance: ProvenanceView[];
}

export interface PropagationPreviewResult {
  metricsBefore: GuestMetrics;
  metricsAfter: GuestMetrics;
  impact: PlanImpact;
  conflictsAfter: Conflict[];
  error?: PatchError;
}

const CATEGORY_LABEL_MAP = new Map(BUDGET_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * Builds structured visual budget metrics, sorted category shares, and provenance distributions.
 * WHY: Powers Budget Ledger tables, progress meters, and breakdown bars with zero runtime I/O.
 *
 * @param plan - Target EventPlan.
 * @returns Fully populated BudgetView.
 */
export function buildBudgetView(plan: EventPlan): BudgetView {
  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const cap = getBudgetCap(plan.constraints);
  const remaining = cap !== null ? cap - total : 0;
  const overCap = cap !== null && total > cap;

  const categoryMap = new Map<BudgetCategory, BudgetCategoryItemView[]>();
  for (const cat of BUDGET_CATEGORY_IDS) {
    categoryMap.set(cat, []);
  }

  for (const item of plan.budgetItems) {
    const cost = itemTotal(item, plan.meta.guestCount);
    const existing = categoryMap.get(item.category) ?? [];
    existing.push({ item, total: cost });
    categoryMap.set(item.category, existing);
  }

  const categories: BudgetCategoryView[] = [];
  for (const [category, items] of categoryMap) {
    const catTotal = items.reduce((sum, i) => sum + i.total, 0);
    if (catTotal > 0) {
      const sharePercent =
        total > 0 ? Number(((catTotal / total) * 100).toFixed(1)) : 0;
      categories.push({
        category,
        label: CATEGORY_LABEL_MAP.get(category) ?? category,
        total: catTotal,
        sharePercent,
        items,
      });
    }
  }

  categories.sort((a, b) => b.total - a.total);

  const provenanceOrder: Provenance[] = ['user', 'estimate', 'verified'];
  const provenance: ProvenanceView[] = provenanceOrder.map((prov) => {
    const provTotal = plan.budgetItems
      .filter((i) => i.provenance === prov)
      .reduce((sum, i) => sum + itemTotal(i, plan.meta.guestCount), 0);
    const sharePercent =
      total > 0 ? Number(((provTotal / total) * 100).toFixed(1)) : 0;
    return {
      provenance: prov,
      total: provTotal,
      sharePercent,
    };
  });

  return {
    total,
    cap,
    remaining,
    overCap,
    categories,
    provenance,
  };
}

/**
 * Computes live what-if projections for headcount changes including guest metrics, cost impact, and conflicts.
 * WHY: Drives interactive WhatIfGuests form with instant, zero-network feedback.
 *
 * @param plan - Target EventPlan (unmodified).
 * @param newGuestCount - Projected guest headcount.
 * @param ctx - Engine context for deterministic preview.
 * @returns Projection results with metrics, impact diffs, and resulting conflicts.
 */
export function propagationPreview(
  plan: EventPlan,
  newGuestCount: number,
  ctx: EngineContext,
): PropagationPreviewResult {
  const metricsBefore = deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds);
  const metricsAfter = deriveGuestMetrics(newGuestCount, plan.guestNeeds);

  const preview = previewOps(
    plan,
    [{ type: 'set_guest_count', guestCount: newGuestCount }],
    ctx,
  );

  if (!preview.ok) {
    return {
      metricsBefore,
      metricsAfter,
      impact: computeImpact(plan, plan, []),
      conflictsAfter: findConflicts(plan, ctx),
      error: preview.error,
    };
  }

  return {
    metricsBefore,
    metricsAfter,
    impact: preview.value.impact,
    conflictsAfter: findConflicts(preview.value.plan, ctx),
  };
}
