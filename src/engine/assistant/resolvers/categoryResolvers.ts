import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { buildOption } from '@/engine/chaos/option';
import { checkRequest } from '@/engine/conflicts';
import type { EngineContext } from '@/engine/context';
import { previewOps } from '@/engine/preview';
import { formatInr } from '@/lib/format';
import type { AdjustCategoryIntent } from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

export function resolveAdjustCategory(
  plan: EventPlan,
  intent: AdjustCategoryIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const op: PlanPatchOp = {
    type: 'scale_category',
    category: intent.category,
    percent: intent.percent,
  };
  const checkRes = checkRequest(plan, [op], ctx);

  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const preview = previewOps(plan, [op], ctx);
  const totalAfter = preview.ok ? preview.value.impact.budgetTotalAfter : totalBefore;

  const directionText = intent.percent >= 0 ? `+${intent.percent}%` : `${intent.percent}%`;

  const opt = buildOption(
    plan,
    [op],
    {
      id: `opt_scale_${intent.category}`,
      label: `Adjust ${intent.category} category by ${directionText}`,
      tradeoff: `Scales all items in ${intent.category} by ${directionText}`,
    },
    ctx,
    false,
    'user',
  );

  if (checkRes.verdict === 'conflict') {
    return {
      kind: 'conflict',
      message: `Scaling category ${intent.category} by ${directionText} exceeds the budget cap.`,
      conflicts: checkRes.newConflicts,
      options: opt ? [opt] : [],
    };
  }

  return {
    kind: 'proposal',
    message: `Proposed adjusting ${intent.category} expenditure by ${directionText}. Total spend changes from ${formatInr(totalBefore)} to ${formatInr(totalAfter)}.`,
    options: opt ? [opt] : [],
    notes: [],
  };
}
