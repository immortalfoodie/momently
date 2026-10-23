import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventPlan } from '@/domain/types';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';
import { useEventDayClock } from '@/components/eventday/useEventDayClock';

const { plan: basePlan } = createPlan({
  meta: {
    ...DEMO_SCENARIO.meta,
    dateIso: '2026-12-25',
  },
  constraints: DEMO_SCENARIO.constraints,
  ids: createIdFactory('clock_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
});

const samplePlanFuture: EventPlan = {
  ...basePlan,
  id: 'plan_future',
  schedule: [
    { id: 's1', title: 'Reception', startMinute: 660, durationMinutes: 60, priority: 'important', flexible: true },
  ],
};

describe('useEventDayClock hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forces practice mode when event date is not today, starting at firstSlot - 30', () => {
    // Current date is 15 Dec 2026 (event is 25 Dec 2026)
    vi.setSystemTime(new Date(2026, 11, 15, 10, 0));

    const { result } = renderHook(() => useEventDayClock(samplePlanFuture));

    expect(result.current.mode).toBe('practice');
    expect(result.current.canGoLive).toBe(false);
    // firstSlotStart is 660 (11:00 AM) -> starts at 660 - 30 = 630 (10:30 AM)
    expect(result.current.minute).toBe(630);

    // Calling goLive is a no-op when canGoLive is false
    act(() => {
      result.current.goLive();
    });
    expect(result.current.mode).toBe('practice');
  });

  it('allows live mode on event day and ticks every 30 seconds', () => {
    // Set time to event day: 25 Dec 2026, 11:15 AM (minute = 11 * 60 + 15 = 675)
    vi.setSystemTime(new Date(2026, 11, 25, 11, 15));

    const { result } = renderHook(() => useEventDayClock(samplePlanFuture));

    expect(result.current.canGoLive).toBe(true);
    expect(result.current.mode).toBe('live');
    expect(result.current.minute).toBe(675);

    // Advance fake timer by 30 seconds (clock is now 11:15:30)
    // Advance by 60 seconds (clock is now 11:16 AM, minute = 676)
    vi.setSystemTime(new Date(2026, 11, 25, 11, 16));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.minute).toBe(676);

    // Can toggle to practice and back to live
    act(() => {
      result.current.practice();
    });
    expect(result.current.mode).toBe('practice');

    act(() => {
      result.current.goLive();
    });
    expect(result.current.mode).toBe('live');
  });

  it('nudges practice minute and clamps to 0-1439', () => {
    vi.setSystemTime(new Date(2026, 11, 15, 10, 0));

    const { result } = renderHook(() => useEventDayClock(samplePlanFuture));

    expect(result.current.minute).toBe(630);

    act(() => {
      result.current.nudge(15);
    });
    expect(result.current.minute).toBe(645);

    act(() => {
      result.current.nudge(-30);
    });
    expect(result.current.minute).toBe(615);

    // Underflow clamp
    act(() => {
      result.current.nudge(-1000);
    });
    expect(result.current.minute).toBe(0);

    // Overflow clamp
    act(() => {
      result.current.nudge(2000);
    });
    expect(result.current.minute).toBe(1439);

    // setPracticeMinute
    act(() => {
      result.current.setPracticeMinute(720);
    });
    expect(result.current.minute).toBe(720);
  });

  it('cleans up timer on unmount', () => {
    vi.setSystemTime(new Date(2026, 11, 25, 11, 15));
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() => useEventDayClock(samplePlanFuture));
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
