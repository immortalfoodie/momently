import type { EventPlan, PlanImpact, PlanPatchOp } from '@/domain/types';
import type { Result } from '@/lib/result';
import type { EngineContext } from './context';
import type { PatchError } from './patch';
import { applyPatch, createPatch } from './patch';

/**
 * Purely computes the hypothetical outcome and differential impact of a set of operations.
 * WHY: Answers "what would happen if" queries for user previews, lever evaluations, and guardian
 * proposals without ever mutating, persisting, or committing changes to the active EventPlan.
 *
 * @param plan - The baseline EventPlan to project against (remains unmodified).
 * @param ops - The list of patch operations to test.
 * @param ctx - Injected engine context providing deterministic ID and clock generators.
 * @returns Result containing projected plan and differential impact, or a PatchError.
 */
export function previewOps(
  plan: EventPlan,
  ops: PlanPatchOp[],
  ctx: EngineContext,
): Result<{ plan: EventPlan; impact: PlanImpact }, PatchError> {
  const patch = createPatch(
    ops,
    'Hypothetical preview projection',
    'user',
    ctx.ids,
    ctx.clock,
    'approved',
  );

  return applyPatch(plan, patch, {
    ...ctx,
    allowHardViolations: true,
  });
}
