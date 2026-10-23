import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { diffPlans, type PlanDiff } from '@/engine/diff';
import type { PatchError } from '@/engine/patch';
import { previewOps } from '@/engine/preview';
import { scoreRisks } from '@/engine/risk';
import { err, ok, type Result } from '@/lib/result';
import type { RecoveryOption } from './types';

export interface OptionPreviewResult {
  plan: EventPlan;
  diff: PlanDiff;
  scoreAfter: number;
}

/**
 * Purely computes the hypothetical projected plan, visual diff, and resulting Chaos Score for a recovery option.
 * WHY: Enables side-by-side comparison tables without mutating the active plan or committing state.
 *
 * @param plan - Baseline EventPlan snapshot (remains unmodified).
 * @param option - Recovery option containing proposed patch operations.
 * @param ctx - Deterministic engine context.
 * @returns Result with projected plan, diff, and scoreAfter, or PatchError. Never throws.
 */
export function previewOption(
  plan: EventPlan,
  option: RecoveryOption,
  ctx: EngineContext,
): Result<OptionPreviewResult, PatchError> {
  try {
    const preview = previewOps(plan, option.patch.ops, ctx);
    if (!preview.ok) {
      return preview;
    }

    const projectedPlan = preview.value.plan;
    const diff = diffPlans(plan, projectedPlan);
    const scoreAfter = scoreRisks(projectedPlan, ctx).score;

    return ok({
      plan: projectedPlan,
      diff,
      scoreAfter,
    });
  } catch (error) {
    return err({
      code: 'invalid_change',
      message: error instanceof Error ? error.message : 'Failed to preview recovery option',
    });
  }
}
