import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import { scenarioAvailability } from './defaults';

/**
 * Vocabulary and facts the language model may use when mapping a free-text disaster.
 * WHY: Sending only allowed values (not the plan) keeps requests small and makes invented
 * categories detectable.
 */
export interface DescribeContext {
  vendorCategories: string[];
  itemFamilies: Array<{ family: string; label: string }>;
  setting: EventPlan['meta']['setting'];
  guestCount: number;
}

/** A scenario the engine refused, with a plain-English reason for the host. */
export interface DroppedScenario {
  input: ChaosScenarioInput;
  reason: string;
}

export interface ReconciledScenarios {
  accepted: ChaosScenarioInput[];
  dropped: DroppedScenario[];
}

const MAX_FAMILIES = 30;
const MAX_CATEGORIES = 20;

/**
 * Builds the allowed vocabulary for the chaos_describe task from the current plan.
 *
 * @param plan - Active EventPlan.
 * @returns Vendor categories, rate-card item families, setting and guest count.
 */
export function buildDescribeContext(plan: EventPlan): DescribeContext {
  const vendorCategories = Array.from(new Set(plan.vendors.map((v) => v.category))).slice(0, MAX_CATEGORIES);

  const seen = new Set<string>();
  const itemFamilies: DescribeContext['itemFamilies'] = [];
  for (const item of plan.budgetItems) {
    const family = item.rateKey?.split('.')[0];
    if (!family || seen.has(family)) continue;
    seen.add(family);
    itemFamilies.push({ family, label: item.label.slice(0, 80) });
  }

  return {
    vendorCategories,
    itemFamilies: itemFamilies.slice(0, MAX_FAMILIES),
    setting: plan.meta.setting,
    guestCount: plan.meta.guestCount,
  };
}

function vocabularyReason(input: ChaosScenarioInput, ctx: DescribeContext): string | null {
  if (input.type === 'vendor_cancels' && !ctx.vendorCategories.includes(input.category)) {
    return `There is no "${input.category}" vendor in this plan.`;
  }
  if (input.type === 'item_unavailable' && !ctx.itemFamilies.some((f) => f.family === input.family)) {
    return `There is no "${input.family}" item in this plan.`;
  }
  return null;
}

/**
 * Re-checks scenarios proposed by the language model against the real plan.
 * WHY: "LLM proposes, engine decides": a mapped scenario only runs if it references real vendors
 * and items, is applicable to the plan, and is not a duplicate.
 *
 * @param plan - Active EventPlan.
 * @param proposed - Scenarios returned by the chaos_describe task.
 * @returns Accepted scenarios in order, plus dropped ones with reasons.
 */
export function reconcileDescribedScenarios(
  plan: EventPlan,
  proposed: readonly ChaosScenarioInput[],
): ReconciledScenarios {
  const ctx = buildDescribeContext(plan);
  const accepted: ChaosScenarioInput[] = [];
  const dropped: DroppedScenario[] = [];
  const seenTypes = new Set<ChaosScenarioInput['type']>();

  for (const input of proposed) {
    if (seenTypes.has(input.type)) continue;
    const reason = vocabularyReason(input, ctx) ?? scenarioAvailability(plan, input.type).reason ?? null;
    if (reason) {
      dropped.push({ input, reason });
      continue;
    }
    seenTypes.add(input.type);
    accepted.push(input);
  }

  return { accepted, dropped };
}
