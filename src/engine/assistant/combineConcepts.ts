import type { BudgetCategory, Concept, EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import { suggestSavings } from '@/engine/guardian';
import { previewOps } from '@/engine/preview';
import { formatInr } from '@/lib/format';
import { err, ok, type Result } from '@/lib/result';
import type { QualityLevel } from '@/domain/baseSchemas';
import type { AssistantError } from './types';
import { categoryForFamily, resolveConceptRef, selectConceptOps } from './concepts';

export interface CombineProposal {
  baseConcept: Concept;
  borrowConcept: Concept;
  combinedProfile: Record<string, QualityLevel>;
  combinedTotal: Money;
  targetTotal: Money | null;
  options: RecoveryOption[];
}

function buildSavingsOptions(
  plan: EventPlan,
  baseOps: PlanPatchOp[],
  combinedPlan: EventPlan,
  combinedTotal: Money,
  target: Money,
  borrowedFamilies: string[],
  ctx: EngineContext,
): RecoveryOption[] {
  const shortfall = Math.max(0, combinedTotal - target);
  const plans = suggestSavings(
    combinedPlan,
    shortfall,
    { protectedFamilies: borrowedFamilies },
    ctx,
  );

  const options: RecoveryOption[] = [];
  for (const sp of plans.slice(0, 3)) {
    const allOps = [...baseOps, ...sp.ops];
    const preview = previewOps(plan, allOps, ctx);
    const actualTotal = preview.ok ? preview.value.impact.budgetTotalAfter : combinedTotal;
    const diff = combinedTotal - actualTotal;
    const actualPct = combinedTotal > 0 ? Math.round((diff / combinedTotal) * 100) : 0;
    const reached = actualTotal <= target;

    const notes = reached
      ? [`Target achieved: ${formatInr(actualTotal)} (${actualPct}% reduction via ${sp.label}).`]
      : [
          `Closest achievable is ${actualPct}% cheaper (${formatInr(actualTotal)}) because protected ${borrowedFamilies.join(', ')} items and baseline floors limit further cuts.`,
        ];

    const opt = buildOption(
      plan,
      allOps,
      {
        id: `opt_combine_${sp.id}`,
        label: `${sp.label} (${formatInr(actualTotal)})`,
        tradeoff: `Applies combined profile with ${sp.levers.length} savings adjustments`,
        notes,
      },
      ctx,
      false,
      'user',
    );
    if (opt) options.push(opt);
  }

  return options;
}

function mergeProfiles(
  baseProfile: Record<string, QualityLevel> | undefined,
  borrowProfile: Record<string, QualityLevel> | undefined,
  borrowCategories: Set<BudgetCategory>,
): { combinedProfile: Record<string, QualityLevel>; borrowedFamilies: string[] } {
  const combinedProfile: Record<string, QualityLevel> = { ...(baseProfile ?? {}) };
  const borrowedFamilies: string[] = [];

  for (const [fam, q] of Object.entries(borrowProfile ?? {})) {
    const cat = categoryForFamily(fam);
    if (cat && borrowCategories.has(cat)) {
      combinedProfile[fam] = q;
      if (fam === 'decor') combinedProfile.decor_theme = q;
      borrowedFamilies.push(fam);
    }
  }

  return { combinedProfile, borrowedFamilies };
}

/**
 * Combines two concepts by taking a base concept and borrowing categories from a second concept.
 * Target savings protect borrowed categories and report honest trade-offs.
 */
export function combineConcepts(
  plan: EventPlan,
  input: {
    baseRef: string;
    borrowRef: string;
    borrowCategories: BudgetCategory[];
    percentCheaper: number | null;
  },
  ctx: EngineContext,
): Result<CombineProposal, AssistantError> {
  const baseRes = resolveConceptRef(plan.concepts, input.baseRef);
  if (!baseRes.ok) return baseRes;
  const borrowRes = resolveConceptRef(plan.concepts, input.borrowRef);
  if (!borrowRes.ok) return borrowRes;

  const borrowCategories = new Set(input.borrowCategories);
  const { combinedProfile, borrowedFamilies } = mergeProfiles(
    baseRes.value.qualityProfile,
    borrowRes.value.qualityProfile,
    borrowCategories,
  );

  const baseOps = selectConceptOps(plan, { qualityProfile: combinedProfile }, ctx);
  const previewCombined = previewOps(plan, baseOps, ctx);
  if (!previewCombined.ok) return err({ message: previewCombined.error.message });

  const combinedTotal = previewCombined.value.impact.budgetTotalAfter;
  let options: RecoveryOption[] = [];
  let targetTotal: Money | null = null;

  if (input.percentCheaper !== null && input.percentCheaper > 0) {
    targetTotal = Math.round((combinedTotal * (100 - input.percentCheaper)) / 100);
    options = buildSavingsOptions(
      plan,
      baseOps,
      previewCombined.value.plan,
      combinedTotal,
      targetTotal,
      borrowedFamilies,
      ctx,
    );
  } else {
    const opt = buildOption(
      plan,
      baseOps,
      {
        id: 'opt_combine_baseline',
        label: `Combine ${baseRes.value.title} with elements of ${borrowRes.value.title}`,
        tradeoff: `Adopts borrowed styling at ${formatInr(combinedTotal)}`,
        notes: [`Combined profile total: ${formatInr(combinedTotal)}`],
      },
      ctx,
      false,
      'user',
    );
    if (opt) options.push(opt);
  }

  return ok({
    baseConcept: baseRes.value,
    borrowConcept: borrowRes.value,
    combinedProfile,
    combinedTotal,
    targetTotal,
    options,
  });
}
