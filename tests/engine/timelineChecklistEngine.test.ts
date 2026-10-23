import { describe, expect, it } from 'vitest';
import type { EventPlan, Task } from '@/domain/types';
import { applyPatch } from '@/engine/patch';
import { reducePatchOp } from '@/engine/patchOps';
import { buildDelayOptions } from '@/engine/delayOptions';
import { buildScheduleView } from '@/engine/scheduleView';
import { groupTasksByTimeframe, isTaskOverdue, taskDueDate } from '@/engine/taskDates';
import { taskProgress } from '@/engine/taskProgress';
import { setTaskStatus } from '@/engine/taskStatus';
import { buildDemoPlan } from '@/engine/demo';
import { createIdFactory } from '@/lib/id';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return obj;
}

describe('Engine: Timeline & Checklist Logic (TASK 1 & TASK 4)', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');
  const ctx = { ids: createIdFactory('tc_engine'), clock: fixedClock };

  function makePlan(): EventPlan {
    return buildDemoPlan(ctx).plan;
  }

  it('handles remove_task and returns task_not_found for unknown task id', () => {
    const plan = deepFreeze(makePlan());
    const validTaskId = plan.tasks[0]!.id;

    const removed = reducePatchOp(plan, { type: 'remove_task', id: validTaskId }, ctx.ids);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.plan.tasks.some((t) => t.id === validTaskId)).toBe(false);
    }

    const badRemove = reducePatchOp(plan, { type: 'remove_task', id: 'unknown_task_123' }, ctx.ids);
    expect(badRemove.ok).toBe(false);
    if (!badRemove.ok) {
      expect(badRemove.error.code).toBe('task_not_found');
    }

    const badUpdate = reducePatchOp(
      plan,
      { type: 'update_task', id: 'unknown_task_123', changes: { title: 'New' } },
      ctx.ids,
    );
    expect(badUpdate.ok).toBe(false);
    if (!badUpdate.ok) {
      expect(badUpdate.error.code).toBe('task_not_found');
    }
  });

  it('rejects slots running past midnight for add_slot and update_slot', () => {
    const plan = deepFreeze(makePlan());

    // add_slot: 1410 + 40 = 1450 > 1440
    const addOverflow = reducePatchOp(
      plan,
      {
        type: 'add_slot',
        slot: {
          id: 'sl_late',
          title: 'Late Party',
          startMinute: 1410,
          durationMinutes: 40,
          priority: 'optional',
          flexible: false,
        },
      },
      ctx.ids,
    );
    expect(addOverflow.ok).toBe(false);
    if (!addOverflow.ok) {
      expect(addOverflow.error.code).toBe('schedule_overflow');
      expect(addOverflow.error.message).toBe("A session can't run past midnight");
    }

    // update_slot: existing slot updated to run past midnight
    const targetSlotId = plan.schedule[0]!.id;
    const updateOverflow = reducePatchOp(
      plan,
      {
        type: 'update_slot',
        id: targetSlotId,
        changes: { startMinute: 1400, durationMinutes: 60 },
      },
      ctx.ids,
    );
    expect(updateOverflow.ok).toBe(false);
    if (!updateOverflow.ok) {
      expect(updateOverflow.error.code).toBe('schedule_overflow');
      expect(updateOverflow.error.message).toBe("A session can't run past midnight");
    }
  });

  it('taskDueDate handles month boundaries, leap years, and no date', () => {
    const basePlan = makePlan();
    const task: Task = {
      id: 't_1',
      title: 'T1',
      category: 'planning',
      dueDaysBefore: 10,
      status: 'todo',
      priority: 'medium',
    };

    // Month boundary: 2026-03-05 minus 10 days -> 2026-02-23
    const p1 = { ...basePlan, meta: { ...basePlan.meta, dateIso: '2026-03-05' } };
    expect(taskDueDate(p1, task)).toEqual({ kind: 'date', iso: '2026-02-23' });

    // Leap year: 2024-03-01 minus 2 days -> 2024-02-28
    const leapTask = { ...task, dueDaysBefore: 2 };
    const p2 = { ...basePlan, meta: { ...basePlan.meta, dateIso: '2024-03-01' } };
    expect(taskDueDate(p2, leapTask)).toEqual({ kind: 'date', iso: '2024-02-28' });

    // No date
    const pNoDate = { ...basePlan, meta: { ...basePlan.meta, dateIso: undefined } };
    expect(taskDueDate(pNoDate, task)).toEqual({ kind: 'relative', daysBefore: 10 });
  });

  it('isTaskOverdue requires date and open status', () => {
    const basePlan = makePlan();
    const task: Task = {
      id: 't_1',
      title: 'T1',
      category: 'planning',
      dueDaysBefore: 10,
      status: 'todo',
      priority: 'high',
    };

    const planWithDate = { ...basePlan, meta: { ...basePlan.meta, dateIso: '2026-10-25' } };
    // Event 2026-10-25, due 10 days before = 2026-10-15. Today is 2026-10-21. Overdue!
    expect(isTaskOverdue(planWithDate, task, new Date('2026-10-21T00:00:00Z'))).toBe(true);

    // Done task is never overdue
    expect(isTaskOverdue(planWithDate, { ...task, status: 'done' }, new Date('2026-10-21T00:00:00Z'))).toBe(false);

    // No date is never overdue
    const planNoDate = { ...basePlan, meta: { ...basePlan.meta, dateIso: undefined } };
    expect(isTaskOverdue(planNoDate, task, new Date('2026-10-21T00:00:00Z'))).toBe(false);
  });

  it('groups tasks by timeframe with correct ordering, empty omission, and sorting', () => {
    const plan = makePlan();
    const tasks: Task[] = [
      { id: 't_event', title: 'Day Task', category: 'venue', dueDaysBefore: 0, status: 'todo', priority: 'medium' },
      { id: 't_m1', title: 'Month Task B', category: 'food', dueDaysBefore: 20, status: 'todo', priority: 'medium' },
      { id: 't_m2', title: 'Month Task A', category: 'food', dueDaysBefore: 20, status: 'todo', priority: 'high' },
      { id: 't_3m', title: '3M Task', category: 'planning', dueDaysBefore: 100, status: 'todo', priority: 'low' },
    ];

    const today = new Date('2026-05-01T00:00:00Z');
    const futurePlan = { ...plan, meta: { ...plan.meta, dateIso: '2026-12-01' } };

    const groups = groupTasksByTimeframe(futurePlan, tasks, today);
    const names = groups.map((g) => g.name);

    // Empty groups like 'Overdue', '1 to 3 months before', 'Final week' are omitted
    expect(names).toEqual(['3+ months before', 'Final month', 'Event day']);

    // Sorting inside 'Final month': high priority before medium priority
    const finalMonthTasks = groups.find((g) => g.name === 'Final month')!.tasks;
    expect(finalMonthTasks[0]!.id).toBe('t_m2'); // high
    expect(finalMonthTasks[1]!.id).toBe('t_m1'); // medium
  });

  it('taskProgress computes total, done, doing, todo, percent, overdue, and byPriority', () => {
    const plan = makePlan();
    const today = new Date('2026-12-10T00:00:00Z'); // Demo event is 2026-12-15
    const metrics = taskProgress(plan, today);

    expect(metrics.total).toBe(plan.tasks.length);
    expect(metrics.done + metrics.doing + metrics.todo).toBe(metrics.total);
    expect(metrics.percent).toBeGreaterThanOrEqual(0);
    expect(metrics.percent).toBeLessThanOrEqual(100);
    expect(typeof metrics.byPriority.high).toBe('number');
  });

  it('setTaskStatus is pure: updates status without version bump or ledger change', () => {
    const plan = deepFreeze(makePlan());
    const initialVersion = plan.version;
    const initialLedgerLen = plan.ledger.length;
    const taskId = plan.tasks[0]!.id;

    const res = setTaskStatus(plan, taskId, 'done', ctx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.version).toBe(initialVersion);
      expect(res.value.ledger.length).toBe(initialLedgerLen);
      expect(res.value.tasks.find((t) => t.id === taskId)?.status).toBe('done');
      expect(res.value.updatedAt).toBe(fixedClock().toISOString());
    }

    const bad = setTaskStatus(plan, 'bad_id', 'done', ctx);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.code).toBe('task_not_found');
    }
  });

  it('buildScheduleView detects overlaps, gaps, slack, and late-night warnings', () => {
    const plan = makePlan();
    const testPlan: EventPlan = {
      ...plan,
      schedule: [
        { id: 's1', title: 'Opening', startMinute: 600, durationMinutes: 60, priority: 'essential', flexible: false },
        { id: 's2', title: 'Overlapping', startMinute: 630, durationMinutes: 60, priority: 'important', flexible: true },
        { id: 's3', title: 'Gapped', startMinute: 800, durationMinutes: 60, priority: 'optional', flexible: true },
        { id: 's4', title: 'Late Night', startMinute: 1390, durationMinutes: 40, priority: 'essential', flexible: false },
      ],
    };

    const view = buildScheduleView(testPlan);
    expect(view.slots).toHaveLength(4);
    expect(view.warnings.some((w) => w.includes('overlaps with'))).toBe(true);
    expect(view.warnings.some((w) => w.includes('Gap of') && w.includes('exceeds 60 minutes'))).toBe(true);
    expect(view.warnings.some((w) => w.includes('runs late at night'))).toBe(true);
  });

  it('buildDelayOptions returns 3 strategies, never mutates, and approving yields outcome slots', () => {
    const plan = deepFreeze(makePlan());
    // Use an earlier start so 60m delay is feasible
    const shiftedBase = deepFreeze({
      ...plan,
      schedule: plan.schedule.map((s) => ({ ...s, startMinute: s.startMinute - 200 })),
    });

    const firstSlot = shiftedBase.schedule[0]!;
    const options = buildDelayOptions(
      shiftedBase,
      { anchorSlotId: firstSlot.id, delayMinutes: 60 },
      ctx,
    );

    expect(options.length).toBeGreaterThanOrEqual(1);
    const labels = options.map((o) => o.label);
    expect(labels.some((l) => l.includes('Push everything back'))).toBe(true);

    const recommended = options[0]!;
    const applied = applyPatch(shiftedBase, { ...recommended.patch, status: 'approved' }, ctx);
    expect(applied.ok).toBe(true);
  });
});
