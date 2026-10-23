import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import type { SavingsPlan } from '@/engine/guardian';
import type { PatchError } from '@/engine/patch';
import { previewOps } from '@/engine/preview';
import { err, ok, type Result } from '@/lib/result';

const SINGLETON_OP_TYPES = new Set([
  'set_budget_cap',
  'set_guest_count',
  'set_meta',
  'select_concept',
]);

function getBudgetOpKey(op: PlanPatchOp): string | undefined {
  if (op.type === 'update_budget_item' || op.type === 'remove_budget_item') {
    return `budget_item:${op.id}`;
  }
  if (op.type === 'add_budget_item') return `budget_item:${op.item.id}`;
  if (op.type === 'scale_category') return `scale_category:${op.category}`;
  return undefined;
}

function getScheduleOrTaskOpKey(op: PlanPatchOp): string | undefined {
  if (op.type === 'update_slot' || op.type === 'remove_slot') return `slot:${op.id}`;
  if (op.type === 'add_slot') return `slot:${op.slot.id}`;
  if (op.type === 'update_task' || op.type === 'remove_task') return `task:${op.id}`;
  if (op.type === 'add_task') return `task:${op.task.id}`;
  return undefined;
}

function getOpTargetKey(op: PlanPatchOp): string | undefined {
  if (SINGLETON_OP_TYPES.has(op.type)) {
    return op.type;
  }
  return getBudgetOpKey(op) ?? getScheduleOrTaskOpKey(op);
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
