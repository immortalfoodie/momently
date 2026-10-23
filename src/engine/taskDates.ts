import type { EventPlan, Task } from '@/domain/types';

export type TaskDueDate =
  | { kind: 'date'; iso: string }
  | { kind: 'relative'; daysBefore: number };

export interface TaskGroup {
  name: string;
  tasks: Task[];
}

/**
 * Computes a task's due date using pure UTC calendar arithmetic without Date.now.
 * WHY: Hydration-safe and timezone-independent milestone calculations.
 */
export function taskDueDate(plan: EventPlan, task: Task): TaskDueDate {
  const dateStr = plan.meta.dateIso;
  if (!dateStr) {
    return { kind: 'relative', daysBefore: task.dueDaysBefore };
  }

  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) {
    return { kind: 'relative', daysBefore: task.dueDaysBefore };
  }

  const eventUtc = Date.UTC(year, month - 1, day);
  const dueUtc = eventUtc - task.dueDaysBefore * 86_400_000;
  const dueDate = new Date(dueUtc);
  const y = dueDate.getUTCFullYear();
  const m = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dueDate.getUTCDate()).padStart(2, '0');

  return { kind: 'date', iso: `${y}-${m}-${d}` };
}

/**
 * Checks if a task is overdue relative to an injected today date.
 * Only returns true if an event date exists and the task is open.
 */
export function isTaskOverdue(plan: EventPlan, task: Task, today: Date): boolean {
  if (task.status === 'done') return false;
  const due = taskDueDate(plan, task);
  if (due.kind !== 'date') return false;

  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, '0');
  const d = String(today.getUTCDate()).padStart(2, '0');
  const todayIso = `${y}-${m}-${d}`;

  return due.iso < todayIso;
}

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function sortGroupTasks(a: Task, b: Task): number {
  const priDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
  if (priDiff !== 0) return priDiff;
  const daysDiff = b.dueDaysBefore - a.dueDaysBefore;
  if (daysDiff !== 0) return daysDiff;
  return a.title.localeCompare(b.title);
}

function determineBucket(task: Task, isOverdue: boolean): string {
  if (isOverdue) return 'Overdue';
  const days = task.dueDaysBefore;
  if (days >= 90) return '3+ months before';
  if (days >= 30) return '1 to 3 months before';
  if (days >= 8) return 'Final month';
  if (days >= 1) return 'Final week';
  return 'Event day';
}

/**
 * Groups tasks by operational timeframe relative to the event date and today.
 * Empty groups are omitted. Tasks within groups are sorted by priority, dueDaysBefore, then title.
 */
export function groupTasksByTimeframe(
  plan: EventPlan,
  tasks: readonly Task[],
  today: Date,
): TaskGroup[] {
  const buckets: Record<string, Task[]> = {
    Overdue: [],
    '3+ months before': [],
    '1 to 3 months before': [],
    'Final month': [],
    'Final week': [],
    'Event day': [],
  };

  for (const task of tasks) {
    const overdue = isTaskOverdue(plan, task, today);
    const bucket = determineBucket(task, overdue);
    buckets[bucket]?.push(task);
  }

  const order = [
    'Overdue',
    '3+ months before',
    '1 to 3 months before',
    'Final month',
    'Final week',
    'Event day',
  ];

  const result: TaskGroup[] = [];
  for (const name of order) {
    const list = buckets[name];
    if (list && list.length > 0) {
      result.push({
        name,
        tasks: [...list].sort(sortGroupTasks),
      });
    }
  }

  return result;
}
