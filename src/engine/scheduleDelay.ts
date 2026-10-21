import type { ScheduleSlot } from '@/domain/types';
import { absorbStrategy, cascadeStrategy, swapStrategy } from './scheduleDelayStrategies';
import type {
  ScheduleDelayInput,
  ScheduleOutcome,
  ScheduleValidation,
} from './scheduleDelayTypes';

export * from './scheduleDelayTypes';

/**
 * Validates a schedule timeline for overlaps, gaps, and total slack minutes.
 * WHY: Gives hosts and coordinators immediate visibility into schedule buffer health and bottlenecks.
 *
 * @param slots - Array of existing schedule slots.
 * @returns ScheduleValidation report with sorted slots, overlaps, gaps, and total slack minutes.
 */
export function validateSchedule(slots: readonly ScheduleSlot[]): ScheduleValidation {
  const sorted = [...slots].sort((a, b) => a.startMinute - b.startMinute);
  const overlaps: Array<[string, string]> = [];
  const gaps: Array<{ afterSlotId: string; minutes: number }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) continue;

    const prevEnd = prev.startMinute + prev.durationMinutes;
    if (curr.startMinute < prevEnd) {
      overlaps.push([prev.id, curr.id]);
    } else if (curr.startMinute > prevEnd) {
      gaps.push({ afterSlotId: prev.id, minutes: curr.startMinute - prevEnd });
    }
  }

  const totalSlackMinutes = gaps.reduce((acc, g) => acc + g.minutes, 0);
  return { overlaps, gaps, totalSlackMinutes };
}

function compareOutcomes(a: ScheduleOutcome, b: ScheduleOutcome): number {
  if (a.feasible !== b.feasible) {
    return a.feasible ? -1 : 1;
  }
  const disruptionA = a.moved.length + a.shortened.length + a.dropped.length;
  const disruptionB = b.moved.length + b.shortened.length + b.dropped.length;
  if (disruptionA !== disruptionB) {
    return disruptionA - disruptionB;
  }
  return a.strategy.localeCompare(b.strategy);
}

/**
 * Proposes schedule delay resolution strategies (cascade, absorb, and swap) for an unexpected delay.
 * WHY: Provides deterministic timeline triage without manual minute re-calculations or overtime blunders.
 *
 * @param slots - Array of schedule slots.
 * @param input - Delay parameters including anchorSlotId, delayMinutes, and optional endLimitMinute.
 * @returns Ordered array of ScheduleOutcome options sorted by feasibility, disruption, and name.
 */
export function proposeDelayOptions(
  slots: readonly ScheduleSlot[],
  input: ScheduleDelayInput,
): ScheduleOutcome[] {
  if (slots.length === 0) return [];

  const sortedSlots = [...slots].sort((a, b) => a.startMinute - b.startMinute);
  const anchor = sortedSlots.find((s) => s.id === input.anchorSlotId);
  if (!anchor) return [];

  const lastSlot = sortedSlots[sortedSlots.length - 1];
  const originalEnd = lastSlot ? lastSlot.startMinute + lastSlot.durationMinutes : 1439;
  const endLimitMinute = Math.min(1439, input.endLimitMinute ?? originalEnd);

  const outcomes: ScheduleOutcome[] = [
    cascadeStrategy(sortedSlots, anchor, input.delayMinutes, endLimitMinute),
    absorbStrategy(sortedSlots, anchor, input.delayMinutes, endLimitMinute),
    swapStrategy(sortedSlots, anchor, input.delayMinutes, endLimitMinute),
  ];

  return outcomes.sort(compareOutcomes);
}
