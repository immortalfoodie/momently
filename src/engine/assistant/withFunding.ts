import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import type { SavingsPlan } from '@/engine/guardian';
import type { PatchError } from '@/engine/patch';
import { previewOps } from '@/engine/preview';
import { err, ok, type Result } from '@/lib/result';

// eslint-disable-next-line complexity
function getOpTargetKey(op: PlanPatchOp): string | undefined {
  switch (op.type) {
    case 'update_budget_item':
    case 'remove_budget_item':
      return `budget_item:${op.id}`;
    case 'add_budget_item':
      return `budget_item:${op.item.id}`;
    case 'scale_category':
      return `scale_category:${op.category}`;
    case 'set_budget_cap':
      return 'set_budget_cap';
    case 'set_guest_count':
      return 'set_guest_count';
    case 'set_meta':
      return 'set_meta';
    case 'update_slot':
    case 'remove_slot':
      return `slot:${op.id}`;
    case 'add_slot':
      return `slot:${op.slot.id}`;
    case 'update_task':
      return `task:${op.id}`;
    case 'add_task':
      return `task:${op.task.id}`;
    case 'select_concept':
      return 'select_concept';
    default:
      return undefined;
  }
}

/**
 * Combines a recovery option with a savings plan strategy, ensuring later operations override earlier
 * conflicts targeting the same item and recomputing real preview metrics.
 *
 * WHY: Enables hosts to fund aspirational additions or crisis recoveries within hard budget caps.
 */
export function withFunding(
  plan: EventPlan,
  option: RecoveryOption,
  strategy: SavingsPlan,
  ctx: EngineContext,
): Result<RecoveryOption, PatchError> {
  const allOps: PlanPatchOp[] = [...option.patch.ops, ...strategy.ops];
  const seenTargets = new Set<string>();
  const reversedDeduplicated: PlanPatchOp[] = [];

  for (let i = allOps.length - 1; i >= 0; i--) {
    const op = allOps[i];
    if (!op) continue;
    const targetKey = getOpTargetKey(op);
    if (targetKey) {
      if (seenTargets.has(targetKey)) {
        continue;
      }
      seenTargets.add(targetKey);
    }
    reversedDeduplicated.push(op);
  }

  const combinedOps = reversedDeduplicated.reverse();

  const preview = previewOps(plan, combinedOps, ctx);
  if (!preview.ok) {
    return err(preview.error);
  }

  const combinedLabel = `${option.label} + funded by: ${strategy.label}`;
  const strategyNotes = strategy.levers.map((l) => `Funding: ${l.label} (saves ₹${l.savings.toLocaleString('en-IN')})`);
  const combinedNotes = [...option.notes, ...strategyNotes];

  const built = buildOption(
    plan,
    combinedOps,
    {
      id: `${option.id}_funded_${strategy.id}`,
      label: combinedLabel,
      tradeoff: option.tradeoff,
      notes: combinedNotes,
    },
    ctx,
  );

  if (!built) {
    return err({
      code: 'hard_constraint_violation',
      message: 'Failed to project recovery option with selected funding strategy',
    });
  }

  return ok(built);
}
