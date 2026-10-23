import type { Contact } from '@/domain/contactSchemas';
import type { EventPlan, ScheduleSlot, Task } from '@/domain/types';
import { isTaskOverdue } from './taskDates';
import { localIsoDate } from '@/lib/time';

export type EventDayPhase = 'before' | 'during' | 'between' | 'after';

export interface DayStatusReport {
  phase: EventDayPhase;
  current?: ScheduleSlot;
  concurrent: ScheduleSlot[];
  next?: ScheduleSlot;
  minutesLeftInCurrent?: number;
  minutesUntilNext?: number;
  later: ScheduleSlot[];
}

export interface ContactCategoryGroup {
  category: string;
  contacts: Contact[];
}

const PRIORITY_WEIGHT: Record<ScheduleSlot['priority'], number> = {
  essential: 3,
  important: 2,
  optional: 1,
};

function sortCurrentSlots(a: ScheduleSlot, b: ScheduleSlot): number {
  if (b.startMinute !== a.startMinute) {
    return b.startMinute - a.startMinute;
  }
  const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (weightDiff !== 0) return weightDiff;
  return a.id.localeCompare(b.id);
}

function resolveUpcomingSlots(
  sorted: ScheduleSlot[],
  minute: number,
  activeIds: Set<string>,
): { next?: ScheduleSlot; later: ScheduleSlot[] } {
  const upcoming = sorted.filter((s) => s.startMinute > minute && !activeIds.has(s.id));
  const next = upcoming[0];
  const later = upcoming.slice(1, 4);
  return { next, later };
}

/**
 * Evaluates the operational timeline phase and active/upcoming activities at a given minute of the day.
 *
 * Edge cases documented:
 * - Empty schedule: returns phase "before" with empty lists and no current/next slots.
 * - Exact minute boundary: start <= minute < start + duration. If a slot ends at minute M, it is not active at M.
 * - Overlapping sessions: the primary current is the one that started most recently; ties break to essential,
 *   then important, then alphabetical by ID. All other active sessions appear in `concurrent`.
 * - Gaps: if the minute is after an activity ends but before the next begins, phase is "between".
 * - Post-event: if the minute is >= the latest activity end time, phase is "after".
 *
 * @param slots - Array of ScheduleSlots.
 * @param minute - Minute of the day (0-1439).
 * @returns DayStatusReport detailing phase, current/concurrent, next, and upcoming later slots.
 */
export function dayStatus(slots: readonly ScheduleSlot[], minute: number): DayStatusReport {
  if (slots.length === 0) {
    return { phase: 'before', concurrent: [], later: [] };
  }

  const sorted = [...slots].sort((a, b) => a.startMinute - b.startMinute);
  const active = sorted.filter((s) => s.startMinute <= minute && minute < s.startMinute + s.durationMinutes);

  if (active.length > 0) {
    active.sort(sortCurrentSlots);
    const current = active[0]!;
    const concurrent = active.slice(1);
    const activeIds = new Set(active.map((s) => s.id));
    const { next, later } = resolveUpcomingSlots(sorted, minute, activeIds);
    const minutesLeftInCurrent = current.startMinute + current.durationMinutes - minute;
    const minutesUntilNext = next ? next.startMinute - minute : undefined;

    return {
      phase: 'during',
      current,
      concurrent,
      next,
      minutesLeftInCurrent,
      minutesUntilNext,
      later,
    };
  }

  const firstStart = sorted[0]!.startMinute;
  const lastEnd = Math.max(...sorted.map((s) => s.startMinute + s.durationMinutes));

  if (minute < firstStart) {
    const next = sorted[0];
    return {
      phase: 'before',
      concurrent: [],
      next,
      minutesUntilNext: next ? next.startMinute - minute : undefined,
      later: sorted.slice(1, 4),
    };
  }

  if (minute >= lastEnd) {
    return { phase: 'after', concurrent: [], later: [] };
  }

  const { next, later } = resolveUpcomingSlots(sorted, minute, new Set());
  return {
    phase: 'between',
    concurrent: [],
    next,
    minutesUntilNext: next ? next.startMinute - minute : undefined,
    later,
  };
}

const TASK_PRIORITY_WEIGHT: Record<Task['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function sortDayTasks(a: Task, b: Task): number {
  if (a.status !== b.status) {
    return a.status === 'doing' ? -1 : 1;
  }
  const priDiff = TASK_PRIORITY_WEIGHT[b.priority] - TASK_PRIORITY_WEIGHT[a.priority];
  if (priDiff !== 0) return priDiff;
  if (a.dueDaysBefore !== b.dueDaysBefore) {
    return a.dueDaysBefore - b.dueDaysBefore;
  }
  return a.title.localeCompare(b.title);
}

/**
 * Selects open checklist tasks that require host attention on the event day.
 * Includes tasks due within 1 day, overdue open tasks, and high-priority milestones.
 */
export function selectDayTasks(plan: EventPlan, today: Date): Task[] {
  return plan.tasks
    .filter((task) => {
      if (task.status === 'done') return false;
      return task.dueDaysBefore <= 1 || isTaskOverdue(plan, task, today) || task.priority === 'high';
    })
    .sort(sortDayTasks);
}

/**
 * Checks whether the plan's target celebration date matches the given calendar date in local time.
 */
export function isEventToday(plan: EventPlan, date: Date): boolean {
  if (!plan.meta.dateIso) return false;
  return plan.meta.dateIso.slice(0, 10) === localIsoDate(date);
}

/**
 * Groups event contacts by category label with "Other" sorted last.
 * Contacts within each category are sorted alphabetically by name.
 */
export function contactsGroupedByCategory(contacts: readonly Contact[]): ContactCategoryGroup[] {
  const map = new Map<string, Contact[]>();

  for (const c of contacts) {
    const rawCat = c.category?.trim();
    const cat = rawCat && rawCat.length > 0 ? rawCat : 'Other';
    const list = map.get(cat);
    if (list) {
      list.push(c);
    } else {
      map.set(cat, [c]);
    }
  }

  const categories = Array.from(map.keys()).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  return categories.map((category) => ({
    category,
    contacts: [...(map.get(category) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
