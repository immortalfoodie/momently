import type { EventPlan, Task } from '@/domain/types';
import type { Result } from '@/lib/result';
import { err, ok } from '@/lib/result';
import type { EngineContext } from './context';
import type { PatchError } from './patchOps';

/**
 * Purely updates a task's progress status in an EventPlan without advancing version or ledger.
 *
 * ARCHITECTURAL INVARIANT (WHY):
 * Task ticks represent operational progress tracking by the host, NOT plan design decisions.
 * Bumping `plan.version` or appending a decision record to `ledger` here would invalidate
 * concurrently open assistant proposals, chaos recoveries, or negotiation suggestions as 'stale',
 * forcing unnecessary re-runs for unrelated todo checkbox toggles.
 *
 * @param plan - Current EventPlan state.
 * @param taskId - Unique identifier of the task to update.
 * @param status - Target status ('todo' | 'doing' | 'done').
 * @param ctx - Engine context providing the system clock.
 * @returns Result containing the updated plan with only tasks and updatedAt modified, or task_not_found error.
 */
export function setTaskStatus(
  plan: EventPlan,
  taskId: string,
  status: Task['status'],
  ctx: Pick<EngineContext, 'clock'>,
): Result<EventPlan, PatchError> {
  const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) {
    return err({
      code: 'task_not_found',
      message: `Task ${taskId} not found`,
    });
  }

  const updatedTasks = plan.tasks.map((task, idx) =>
    idx === taskIndex ? { ...task, status } : task,
  );

  return ok({
    ...plan,
    tasks: updatedTasks,
    updatedAt: ctx.clock().toISOString(),
  });
}
