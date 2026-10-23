import type { EventPlan, Task } from '@/domain/types';
import { taskDueDate } from '@/engine/taskDates';
import { type CsvCell, toCsv } from './csv';

const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function compareChecklistTasks(plan: EventPlan, a: Task, b: Task): number {
  const dueA = taskDueDate(plan, a);
  const dueB = taskDueDate(plan, b);

  const hasDateA = dueA.kind === 'date';
  const hasDateB = dueB.kind === 'date';
  if (hasDateA !== hasDateB) {
    return hasDateA ? -1 : 1;
  }

  if (dueA.kind === 'date' && dueB.kind === 'date' && dueA.iso !== dueB.iso) {
    return dueA.iso.localeCompare(dueB.iso);
  }

  if (a.dueDaysBefore !== b.dueDaysBefore) {
    return b.dueDaysBefore - a.dueDaysBefore;
  }

  const priDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priDiff !== 0) {
    return priDiff;
  }

  return a.title.localeCompare(b.title);
}

/**
 * Generates an RFC 4180 CSV spreadsheet of the event checklist.
 * WHY: Provides coordinators with a chronologically sorted task list ready for offline tracking.
 *
 * @param plan - Active EventPlan.
 * @param today - Optional reference Date (accepted for uniform export signature).
 * @returns RFC 4180 CSV string.
 */
export function checklistCsv(plan: EventPlan, today?: Date): string {
  void today;
  const header: CsvCell[] = [
    'Task',
    'Category',
    'Priority',
    'Status',
    'Due date',
    'Days before event',
    'Notes',
  ];

  const sortedTasks = [...plan.tasks].sort((a, b) => compareChecklistTasks(plan, a, b));

  const rows: CsvCell[][] = [header];
  for (const task of sortedTasks) {
    const due = taskDueDate(plan, task);
    const dueIso = due.kind === 'date' ? due.iso : '';

    rows.push([
      task.title,
      task.category,
      task.priority,
      task.status,
      dueIso,
      task.dueDaysBefore,
      task.notes ?? '',
    ]);
  }

  return toCsv(rows);
}
