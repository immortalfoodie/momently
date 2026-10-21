import type { ScheduleSlot } from '@/domain/types';
import type { Result } from '@/lib/result';
import { err, ok } from '@/lib/result';

/**
 * Shifts schedule slots starting at or after a given minute by a relative delta.
 * WHY: Enables timeline adjustments (delays, early starts) while guarding against 24-hour day boundary overflows.
 *
 * @param slots - Array of existing schedule slots.
 * @param fromMinute - Minute threshold (0-1439) at or after which slots will be shifted.
 * @param deltaMinutes - Relative delta in minutes (-240 to 240).
 * @returns A Result with the shifted slots array, or 'schedule_overflow' if any slot breaches 00:00 to 24:00.
 */
export function shiftSlots(
  slots: readonly ScheduleSlot[],
  fromMinute: number,
  deltaMinutes: number,
): Result<ScheduleSlot[], 'schedule_overflow'> {
  const shifted: ScheduleSlot[] = [];

  for (const slot of slots) {
    if (slot.startMinute >= fromMinute) {
      const newStart = slot.startMinute + deltaMinutes;
      if (newStart < 0 || newStart > 1439 || newStart + slot.durationMinutes > 1440) {
        return err('schedule_overflow');
      }
      shifted.push({
        ...slot,
        startMinute: newStart,
      });
    } else {
      shifted.push({ ...slot });
    }
  }

  return ok(shifted);
}
