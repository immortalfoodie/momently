import type { PlanPatchOp, ScheduleSlot } from '@/domain/types';
import { formatMinuteOfDay } from '@/lib/format';
import { clampMinute } from './scheduleDelayAbsorb';
import type { ScheduleOutcome } from './scheduleDelayTypes';

export { absorbStrategy } from './scheduleDelayAbsorb';

export function cascadeStrategy(
  sortedSlots: readonly ScheduleSlot[],
  anchor: ScheduleSlot,
  delayMinutes: number,
  endLimitMinute: number,
): ScheduleOutcome {
  const moved: Array<{ id: string; fromStart: number; toStart: number }> = [];
  const ops: PlanPatchOp[] = [];

  const newSlots = sortedSlots.map((slot) => {
    if (slot.startMinute < anchor.startMinute) {
      return { ...slot };
    }
    const toStart = clampMinute(slot.startMinute + delayMinutes);
    moved.push({ id: slot.id, fromStart: slot.startMinute, toStart });
    ops.push({ type: 'update_slot', id: slot.id, changes: { startMinute: toStart } });
    return { ...slot, startMinute: toStart };
  });

  const lastSlot = newSlots[newSlots.length - 1];
  const newLastEnd = lastSlot ? lastSlot.startMinute + lastSlot.durationMinutes : 0;
  const overflowMinutes = Math.max(0, newLastEnd - endLimitMinute);
  const feasible = overflowMinutes === 0;

  const summary = feasible
    ? `Cascade shifts ${moved.length} slots by ${delayMinutes}m. Timeline concludes on time at ${formatMinuteOfDay(newLastEnd)}.`
    : `Cascade shifts ${moved.length} slots by ${delayMinutes}m, overrunning the ${formatMinuteOfDay(endLimitMinute)} limit by ${overflowMinutes}m.`;

  return {
    strategy: 'cascade',
    slots: newSlots,
    moved,
    shortened: [],
    dropped: [],
    overflowMinutes,
    feasible,
    summary,
    ops,
  };
}

function executeSwap(
  sortedSlots: readonly ScheduleSlot[],
  anchorIndex: number,
  anchor: ScheduleSlot,
  nextSlot: ScheduleSlot,
  anchorNewStart: number,
  laterShift: number,
): {
  swappedSlots: ScheduleSlot[];
  moved: Array<{ id: string; fromStart: number; toStart: number }>;
  ops: PlanPatchOp[];
} {
  const swappedSlots: ScheduleSlot[] = [];
  const moved: Array<{ id: string; fromStart: number; toStart: number }> = [];
  const ops: PlanPatchOp[] = [];

  for (let i = 0; i < sortedSlots.length; i++) {
    const s = sortedSlots[i];
    if (!s) continue;
    if (i < anchorIndex) {
      swappedSlots.push({ ...s });
    } else if (i === anchorIndex) {
      const updatedNext = { ...nextSlot, startMinute: clampMinute(anchor.startMinute) };
      swappedSlots.push(updatedNext);
      moved.push({
        id: nextSlot.id,
        fromStart: nextSlot.startMinute,
        toStart: updatedNext.startMinute,
      });
      ops.push({
        type: 'update_slot',
        id: nextSlot.id,
        changes: { startMinute: updatedNext.startMinute },
      });

      const updatedAnchor = { ...anchor, startMinute: clampMinute(anchorNewStart) };
      swappedSlots.push(updatedAnchor);
      moved.push({
        id: anchor.id,
        fromStart: anchor.startMinute,
        toStart: updatedAnchor.startMinute,
      });
      ops.push({
        type: 'update_slot',
        id: anchor.id,
        changes: { startMinute: updatedAnchor.startMinute },
      });
    } else if (i === anchorIndex + 1) {
      continue;
    } else {
      const newStart = clampMinute(s.startMinute + laterShift);
      const updated = { ...s, startMinute: newStart };
      swappedSlots.push(updated);
      if (newStart !== s.startMinute) {
        moved.push({ id: s.id, fromStart: s.startMinute, toStart: newStart });
        ops.push({ type: 'update_slot', id: s.id, changes: { startMinute: newStart } });
      }
    }
  }

  return { swappedSlots, moved, ops };
}

export function swapStrategy(
  sortedSlots: readonly ScheduleSlot[],
  anchor: ScheduleSlot,
  delayMinutes: number,
  endLimitMinute: number,
): ScheduleOutcome {
  const anchorIndex = sortedSlots.findIndex((s) => s.id === anchor.id);
  const nextSlot = anchorIndex >= 0 ? sortedSlots[anchorIndex + 1] : undefined;

  if (!nextSlot || !anchor.flexible || !nextSlot.flexible) {
    const reason = !nextSlot
      ? 'no subsequent slot exists to swap with'
      : `${anchor.flexible ? nextSlot.title : anchor.title} is fixed and cannot be swapped`;
    return {
      strategy: 'swap',
      slots: [...sortedSlots],
      moved: [],
      shortened: [],
      dropped: [],
      overflowMinutes: 0,
      feasible: false,
      summary: `Swap not eligible: ${reason}.`,
      ops: [],
    };
  }

  const anchorNewStart = Math.max(
    anchor.startMinute + nextSlot.durationMinutes,
    anchor.startMinute + delayMinutes,
  );
  const anchorNewEnd = anchorNewStart + anchor.durationMinutes;
  const originalNextEnd = nextSlot.startMinute + nextSlot.durationMinutes;
  const laterShift = Math.max(0, anchorNewEnd - originalNextEnd);

  const { swappedSlots, moved, ops } = executeSwap(
    sortedSlots,
    anchorIndex,
    anchor,
    nextSlot,
    anchorNewStart,
    laterShift,
  );

  const last = swappedSlots[swappedSlots.length - 1];
  const newLastEnd = last ? last.startMinute + last.durationMinutes : 0;
  const overflowMinutes = Math.max(0, newLastEnd - endLimitMinute);
  const feasible = overflowMinutes === 0;

  const summary = feasible
    ? `Swapped "${anchor.title}" with "${nextSlot.title}". Concludes on time at ${formatMinuteOfDay(newLastEnd)}.`
    : `Swapped "${anchor.title}" with "${nextSlot.title}", overrunning limit by ${overflowMinutes}m.`;

  return {
    strategy: 'swap',
    slots: swappedSlots,
    moved,
    shortened: [],
    dropped: [],
    overflowMinutes,
    feasible,
    summary,
    ops,
  };
}
