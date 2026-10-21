import type { PlanPatchOp, ScheduleSlot } from '@/domain/types';
import { formatMinuteOfDay } from '@/lib/format';
import type { ScheduleOutcome } from './scheduleDelayTypes';
import { cascadeStrategy } from './scheduleDelayStrategies';

export function clampMinute(val: number): number {
  return Math.max(0, Math.min(1439, val));
}

function computeMinDuration(slot: ScheduleSlot): number {
  if (typeof slot.minDurationMinutes === 'number') {
    return slot.minDurationMinutes;
  }
  return Math.max(5, Math.round((slot.durationMinutes * 0.7) / 5) * 5);
}

interface ShrinkState {
  slots: ScheduleSlot[];
  shortened: Array<{ id: string; fromDuration: number; toDuration: number }>;
  remainingDelay: number;
}

function tryShrinkPriority(
  state: ShrinkState,
  targetPriority: 'optional' | 'important',
): ShrinkState {
  let { remainingDelay } = state;
  const currentSlots = [...state.slots];
  const shortened = [...state.shortened];

  for (let i = 0; i < currentSlots.length && remainingDelay > 0; i++) {
    const slot = currentSlots[i];
    if (!slot || slot.priority !== targetPriority || !slot.flexible) continue;

    const minDur = computeMinDuration(slot);
    const maxShrink = Math.max(0, slot.durationMinutes - minDur);
    const shrink = Math.min(maxShrink, remainingDelay);
    if (shrink <= 0) continue;

    const newDur = slot.durationMinutes - shrink;
    shortened.push({
      id: slot.id,
      fromDuration: slot.durationMinutes,
      toDuration: newDur,
    });
    currentSlots[i] = { ...slot, durationMinutes: newDur };
    remainingDelay -= shrink;

    for (let j = i + 1; j < currentSlots.length; j++) {
      const later = currentSlots[j];
      if (later) {
        currentSlots[j] = {
          ...later,
          startMinute: clampMinute(later.startMinute - shrink),
        };
      }
    }
  }

  return { slots: currentSlots, shortened, remainingDelay };
}

function tryDropOptional(
  state: ShrinkState,
  anchorStart: number,
): {
  slots: ScheduleSlot[];
  shortened: Array<{ id: string; fromDuration: number; toDuration: number }>;
  dropped: string[];
  remainingDelay: number;
} {
  let { remainingDelay } = state;
  let currentSlots = [...state.slots];
  const dropped: string[] = [];

  while (remainingDelay > 0) {
    const candidates = currentSlots
      .map((s, idx) => ({ slot: s, idx }))
      .filter((c) => c.slot.startMinute >= anchorStart && c.slot.priority === 'optional')
      .sort((a, b) => b.slot.durationMinutes - a.slot.durationMinutes);

    const target = candidates[0];
    if (!target) break;

    const dropDuration = target.slot.durationMinutes;
    dropped.push(target.slot.id);
    currentSlots = currentSlots.filter((s) => s.id !== target.slot.id);
    remainingDelay = Math.max(0, remainingDelay - dropDuration);

    for (let j = target.idx; j < currentSlots.length; j++) {
      const later = currentSlots[j];
      if (later) {
        currentSlots[j] = {
          ...later,
          startMinute: clampMinute(later.startMinute - dropDuration),
        };
      }
    }
  }

  return { slots: currentSlots, shortened: state.shortened, dropped, remainingDelay };
}

function computeAbsorbOps(
  sortedSlots: readonly ScheduleSlot[],
  finalSlots: readonly ScheduleSlot[],
  dropped: readonly string[],
): {
  moved: Array<{ id: string; fromStart: number; toStart: number }>;
  ops: PlanPatchOp[];
} {
  const moved: Array<{ id: string; fromStart: number; toStart: number }> = [];
  const ops: PlanPatchOp[] = [];

  for (const orig of sortedSlots) {
    if (dropped.includes(orig.id)) {
      ops.push({ type: 'remove_slot', id: orig.id });
      continue;
    }
    const current = finalSlots.find((s) => s.id === orig.id);
    if (!current) continue;

    const startChanged = current.startMinute !== orig.startMinute;
    const durChanged = current.durationMinutes !== orig.durationMinutes;
    if (startChanged) {
      moved.push({
        id: orig.id,
        fromStart: orig.startMinute,
        toStart: current.startMinute,
      });
    }
    if (startChanged || durChanged) {
      ops.push({
        type: 'update_slot',
        id: orig.id,
        changes: {
          ...(startChanged ? { startMinute: current.startMinute } : {}),
          ...(durChanged ? { durationMinutes: current.durationMinutes } : {}),
        },
      });
    }
  }

  return { moved, ops };
}

function formatAbsorbSummary(
  feasible: boolean,
  shortenedCount: number,
  droppedCount: number,
  newLastEnd: number,
  overflowMinutes: number,
): string {
  const parts: string[] = [];
  if (shortenedCount > 0) parts.push(`shortened ${shortenedCount} slots`);
  if (droppedCount > 0) parts.push(`dropped ${droppedCount} optional slots`);
  const details = parts.length > 0 ? parts.join(', ') : 'no slot reductions required';

  if (feasible) {
    return `Absorbed delay (${details}). Timeline finishes on time at ${formatMinuteOfDay(newLastEnd)}.`;
  }
  return `Absorb recovered partial time (${details}), but still overruns limit by ${overflowMinutes}m.`;
}

export function absorbStrategy(
  sortedSlots: readonly ScheduleSlot[],
  anchor: ScheduleSlot,
  delayMinutes: number,
  endLimitMinute: number,
): ScheduleOutcome {
  const cascaded = cascadeStrategy(sortedSlots, anchor, delayMinutes, endLimitMinute);
  const initialOverflow = cascaded.overflowMinutes;

  let state: ShrinkState = {
    slots: cascaded.slots,
    shortened: [],
    remainingDelay: initialOverflow,
  };

  state = tryShrinkPriority(state, 'optional');
  state = tryShrinkPriority(state, 'important');
  const dropResult = tryDropOptional(state, anchor.startMinute);

  const finalSlots = dropResult.slots;
  const last = finalSlots[finalSlots.length - 1];
  const newLastEnd = last ? last.startMinute + last.durationMinutes : 0;
  const overflowMinutes = Math.max(0, newLastEnd - endLimitMinute);
  const feasible = overflowMinutes === 0;

  const { moved, ops } = computeAbsorbOps(sortedSlots, finalSlots, dropResult.dropped);
  const summary = formatAbsorbSummary(
    feasible,
    dropResult.shortened.length,
    dropResult.dropped.length,
    newLastEnd,
    overflowMinutes,
  );

  return {
    strategy: 'absorb',
    slots: finalSlots,
    moved,
    shortened: dropResult.shortened,
    dropped: dropResult.dropped,
    overflowMinutes,
    feasible,
    summary,
    ops,
  };
}
