import type { EventPlan, PlanPatchOp } from '@/domain/types';
import type { OpResult } from './patchOps';
import { err, ok } from '@/lib/result';
import { shiftSlots } from './schedule';

export type ScheduleOpType = 'add_slot' | 'update_slot' | 'remove_slot' | 'shift_schedule';
export type SchedulePatchOp = Extract<PlanPatchOp, { type: ScheduleOpType }>;

export function isScheduleOp(op: PlanPatchOp): op is SchedulePatchOp {
  return (
    op.type === 'add_slot' ||
    op.type === 'update_slot' ||
    op.type === 'remove_slot' ||
    op.type === 'shift_schedule'
  );
}

export function handleScheduleOps(plan: EventPlan, op: SchedulePatchOp): OpResult {
  if (op.type === 'shift_schedule') {
    const shifted = shiftSlots(plan.schedule, op.fromMinute, op.deltaMinutes);
    if (!shifted.ok) {
      return err({
        code: 'schedule_overflow',
        message: 'Shifted schedule slots would breach 00:00 to 24:00 boundary',
      });
    }
    return ok({ plan: { ...plan, schedule: shifted.value }, notes: [] });
  }
  if (op.type === 'add_slot') {
    if (op.slot.startMinute + op.slot.durationMinutes > 1440) {
      return err({ code: 'schedule_overflow', message: "A session can't run past midnight" });
    }
    return ok({ plan: { ...plan, schedule: [...plan.schedule, op.slot] }, notes: [] });
  }
  const existing = plan.schedule.find((s) => s.id === op.id);
  if (!existing) return err({ code: 'slot_not_found', message: `Slot ${op.id} not found` });

  if (op.type === 'update_slot') {
    const start = op.changes.startMinute ?? existing.startMinute;
    const dur = op.changes.durationMinutes ?? existing.durationMinutes;
    if (start + dur > 1440) {
      return err({ code: 'schedule_overflow', message: "A session can't run past midnight" });
    }
    const schedule = plan.schedule.map((s) => (s.id === op.id ? { ...s, ...op.changes } : s));
    return ok({ plan: { ...plan, schedule }, notes: [] });
  }

  const schedule = plan.schedule.filter((s) => s.id !== op.id);
  return ok({ plan: { ...plan, schedule }, notes: [] });
}
