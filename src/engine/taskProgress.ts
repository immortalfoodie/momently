import type { EventPlan } from '@/domain/types';
import { isTaskOverdue, taskDueDate } from './taskDates';

export interface TaskProgressMetrics {
  total: number;
  done: number;
  doing: number;
  todo: number;
  percent: number;
  overdue: number;
  dueSoon: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
}

function checkDueSoon(
  plan: EventPlan,
  task: EventPlan['tasks'][number],
  todayUtc: number
): boolean {
  const due = taskDueDate(plan, task);
  if (due.kind !== 'date') return false;
  const parts = due.iso.split('-').map(Number);
  const dy = parts[0] ?? 2000;
  const dm = parts[1] ?? 1;
  const dd = parts[2] ?? 1;
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const diffDays = Math.round((dueUtc - todayUtc) / 86_400_000);
  return diffDays >= 0 && diffDays <= 7;
}

/**
 * Purely computes milestone completion progress and upcoming urgency metrics.
 * WHY: Drives the host progress meter and urgency badges without mutating plan state.
 *
 * @param plan - Current EventPlan containing checklist tasks.
 * @param today - Current reference date for overdue and dueSoon calculations.
 * @returns TaskProgressMetrics summary.
 */
export function taskProgress(plan: EventPlan, today: Date): TaskProgressMetrics {
  const total = plan.tasks.length;
  let done = 0;
  let doing = 0;
  let todo = 0;
  let overdue = 0;
  let dueSoon = 0;
  const byPriority = { high: 0, medium: 0, low: 0 };

  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  for (const task of plan.tasks) {
    if (task.status === 'done') {
      done++;
      continue;
    }
    if (task.status === 'doing') {
      doing++;
    } else {
      todo++;
    }

    byPriority[task.priority]++;

    if (isTaskOverdue(plan, task, today)) {
      overdue++;
    } else if (checkDueSoon(plan, task, todayUtc)) {
      dueSoon++;
    }
  }

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    done,
    doing,
    todo,
    percent,
    overdue,
    dueSoon,
    byPriority,
  };
}

