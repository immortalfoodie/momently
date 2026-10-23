import type { EventPlan, ScheduleSlot } from '@/domain/types';
import { validateSchedule } from './scheduleDelay';

export interface ScheduleSlotView {
  slot: ScheduleSlot;
  endMinute: number;
  overlapsWith: string[];
  gapBeforeMinutes: number;
}

export interface ScheduleViewReport {
  slots: ScheduleSlotView[];
  totalSpanMinutes: number;
  totalSlackMinutes: number;
  warnings: string[];
}

function buildSlotViews(
  sorted: ScheduleSlot[],
  overlaps: readonly (readonly [string, string])[],
): ScheduleSlotView[] {
  const overlapMap = new Map<string, Set<string>>();
  for (const s of sorted) {
    overlapMap.set(s.id, new Set());
  }
  for (const [idA, idB] of overlaps) {
    overlapMap.get(idA)?.add(idB);
    overlapMap.get(idB)?.add(idA);
  }

  return sorted.map((slot, i) => {
    const endMinute = slot.startMinute + slot.durationMinutes;
    let gapBeforeMinutes = 0;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      gapBeforeMinutes = Math.max(0, slot.startMinute - (prev.startMinute + prev.durationMinutes));
    }
    return {
      slot,
      endMinute,
      overlapsWith: Array.from(overlapMap.get(slot.id) ?? []),
      gapBeforeMinutes,
    };
  });
}

function collectOverlapAndGapWarnings(
  sorted: ScheduleSlot[],
  validation: ReturnType<typeof validateSchedule>,
): string[] {
  const warnings: string[] = [];
  for (const [idA, idB] of validation.overlaps) {
    const slotA = sorted.find((s) => s.id === idA);
    const slotB = sorted.find((s) => s.id === idB);
    warnings.push(`"${slotA?.title ?? idA}" overlaps with "${slotB?.title ?? idB}"`);
  }
  for (const gap of validation.gaps) {
    if (gap.minutes > 60) {
      const slotBefore = sorted.find((s) => s.id === gap.afterSlotId);
      warnings.push(
        `Gap of ${gap.minutes} minutes after "${slotBefore?.title ?? gap.afterSlotId}" exceeds 60 minutes`,
      );
    }
  }
  return warnings;
}

function collectTimingWarnings(
  sorted: ScheduleSlot[],
  slotViews: ScheduleSlotView[],
  totalSlackMinutes: number,
): string[] {
  const warnings: string[] = [];
  if (totalSlackMinutes < 30 && sorted.length > 1) {
    warnings.push(`Less than 30 minutes of slack in total (${totalSlackMinutes}m remaining)`);
  }
  for (const v of slotViews) {
    if (v.endMinute > 1380) {
      warnings.push(`"${v.slot.title}" runs late at night after 23:00`);
    }
  }
  return warnings;
}

/**
 * Builds an enriched view of an EventPlan's schedule with gaps, overlaps, span, and warnings.
 * Reuses validateSchedule for pure deterministic schedule inspection.
 *
 * @param plan - Current EventPlan.
 * @returns ScheduleViewReport.
 */
export function buildScheduleView(plan: EventPlan): ScheduleViewReport {
  if (plan.schedule.length === 0) {
    return {
      slots: [],
      totalSpanMinutes: 0,
      totalSlackMinutes: 0,
      warnings: [],
    };
  }

  const sorted = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);
  const validation = validateSchedule(sorted);
  const slotViews = buildSlotViews(sorted, validation.overlaps);

  const first = slotViews[0]!;
  const last = slotViews[slotViews.length - 1]!;
  const totalSpanMinutes = Math.max(0, last.endMinute - first.slot.startMinute);
  const warnings = [
    ...collectOverlapAndGapWarnings(sorted, validation),
    ...collectTimingWarnings(sorted, slotViews, validation.totalSlackMinutes),
  ];

  return {
    slots: slotViews,
    totalSpanMinutes,
    totalSlackMinutes: validation.totalSlackMinutes,
    warnings,
  };
}
