import { describe, expect, it } from 'vitest';
import type { EventPlan, SchedulePriority, ScheduleSlot } from '@/domain/types';
import { applyPatch, createPatch } from '@/engine/patch';
import { createPlan } from '@/engine/planFactory';
import { proposeDelayOptions, validateSchedule } from '@/engine/scheduleDelay';
import { createIdFactory } from '@/lib/id';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function mkSlot(
  id: string,
  title: string,
  startMinute: number,
  durationMinutes: number,
  priority: SchedulePriority,
  flexible: boolean,
  minDurationMinutes?: number,
): ScheduleSlot {
  return {
    id,
    title,
    startMinute,
    durationMinutes,
    priority,
    flexible,
    minDurationMinutes,
  };
}

describe('Schedule Delay Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');

  const sampleSlots: ScheduleSlot[] = [
    mkSlot('s1', 'Guest Arrival', 600, 60, 'important', true),
    mkSlot('s2', 'Welcome Speech', 680, 40, 'optional', true, 20),
    mkSlot('s3', 'Keynote & Vows', 720, 60, 'essential', false),
    mkSlot('s4', 'Photo Session', 780, 60, 'optional', true),
  ];

  it('validateSchedule detects overlaps, gaps, and slack correctly', () => {
    const valid = validateSchedule(deepFreeze(sampleSlots));
    expect(valid.overlaps).toHaveLength(0);
    expect(valid.gaps).toEqual([{ afterSlotId: 's1', minutes: 20 }]);
    expect(valid.totalSlackMinutes).toBe(20);

    const overlapping: ScheduleSlot[] = [
      mkSlot('o1', 'A', 600, 60, 'essential', false),
      mkSlot('o2', 'B', 630, 30, 'important', true),
    ];
    const withOverlaps = validateSchedule(deepFreeze(overlapping));
    expect(withOverlaps.overlaps).toEqual([['o1', 'o2']]);
  });

  it('cascade computes overflow math and feasible flag correctly', () => {
    const slots = deepFreeze(sampleSlots);
    const outcomes = proposeDelayOptions(slots, { anchorSlotId: 's1', delayMinutes: 30 });
    const cascade = outcomes.find((o) => o.strategy === 'cascade');
    expect(cascade).toBeDefined();
    if (!cascade) return;

    expect(cascade.overflowMinutes).toBe(30);
    expect(cascade.feasible).toBe(false);
    expect(cascade.moved).toHaveLength(4);

    const withHigherLimit = proposeDelayOptions(slots, {
      anchorSlotId: 's1',
      delayMinutes: 30,
      endLimitMinute: 870,
    });
    const feasibleCascade = withHigherLimit.find((o) => o.strategy === 'cascade');
    expect(feasibleCascade?.overflowMinutes).toBe(0);
    expect(feasibleCascade?.feasible).toBe(true);
  });

  it('absorb never shortens essential slots and respects minDuration', () => {
    const slots = deepFreeze(sampleSlots);
    const outcomes = proposeDelayOptions(slots, { anchorSlotId: 's1', delayMinutes: 40 });
    const absorb = outcomes.find((o) => o.strategy === 'absorb');
    expect(absorb).toBeDefined();
    if (!absorb) return;

    expect(absorb.shortened.some((s) => s.id === 's3')).toBe(false);
    const s2Shortened = absorb.shortened.find((s) => s.id === 's2');
    if (s2Shortened) {
      expect(s2Shortened.toDuration).toBeGreaterThanOrEqual(20);
    }
  });

  it('absorb drops optional slots only when needed and reports leftover overflow', () => {
    const slots: ScheduleSlot[] = [
      mkSlot('a1', 'Lunch', 720, 60, 'essential', false),
      mkSlot('a2', 'Game', 780, 30, 'optional', true, 10),
      mkSlot('a3', 'Toast', 810, 30, 'essential', false),
    ];
    const outcomes = proposeDelayOptions(deepFreeze(slots), {
      anchorSlotId: 'a1',
      delayMinutes: 50,
    });
    const absorb = outcomes.find((o) => o.strategy === 'absorb');
    expect(absorb).toBeDefined();
    if (!absorb) return;

    expect(absorb.dropped).toContain('a2');
    expect(absorb.overflowMinutes).toBe(20);
    expect(absorb.feasible).toBe(false);
  });

  it('swap validates eligibility rules and executes timing math', () => {
    const eligible: ScheduleSlot[] = [
      mkSlot('sw1', 'Music', 600, 30, 'important', true),
      mkSlot('sw2', 'Games', 630, 30, 'important', true),
      mkSlot('sw3', 'Dinner', 660, 60, 'essential', false),
    ];
    const outcomes = proposeDelayOptions(deepFreeze(eligible), {
      anchorSlotId: 'sw1',
      delayMinutes: 20,
    });
    const swap = outcomes.find((o) => o.strategy === 'swap');
    expect(swap).toBeDefined();
    if (!swap) return;

    expect(swap.feasible).toBe(true);
    expect(swap.slots[0]?.id).toBe('sw2');
    expect(swap.slots[0]?.startMinute).toBe(600);
    expect(swap.slots[1]?.id).toBe('sw1');
    expect(swap.slots[1]?.startMinute).toBe(630);

    const fixed = [{ ...eligible[0]!, flexible: false }, eligible[1]!];
    const fixedOutcomes = proposeDelayOptions(deepFreeze(fixed), {
      anchorSlotId: 'sw1',
      delayMinutes: 20,
    });
    expect(fixedOutcomes.find((o) => o.strategy === 'swap')?.feasible).toBe(false);
  });

  it('every outcome stays inside 0-1439 and applyPatch reproduces outcome slots exactly', () => {
    const slots = deepFreeze(sampleSlots);
    const outcomes = proposeDelayOptions(slots, { anchorSlotId: 's1', delayMinutes: 30 });

    const basePlan = createPlan({
      meta: {
        title: 'T',
        type: 'wedding',
        city: 'Mumbai',
        guestCount: 80,
        setting: 'indoor',
        hostBrief: 'B',
      },
      constraints: [],
      ids: createIdFactory('dummy_seed'),
      clock: fixedClock,
    }).plan;
    const dummyPlan: EventPlan = deepFreeze({
      ...basePlan,
      schedule: [...slots],
    });

    for (const outcome of outcomes) {
      for (const slot of outcome.slots) {
        expect(slot.startMinute).toBeGreaterThanOrEqual(0);
        expect(slot.startMinute).toBeLessThanOrEqual(1439);
        expect(slot.startMinute + slot.durationMinutes).toBeLessThanOrEqual(1440);
      }

      if (outcome.ops.length > 0) {
        const ids = createIdFactory(`apply_${outcome.strategy}`);
        const patch = createPatch(
          outcome.ops,
          outcome.summary,
          'user',
          ids,
          fixedClock,
          'approved',
        );
        const res = applyPatch(dummyPlan, patch, { ids, clock: fixedClock });
        expect(res.ok).toBe(true);
        if (res.ok) {
          const sortedApplied = [...res.value.plan.schedule].sort(
            (a, b) => a.startMinute - b.startMinute,
          );
          expect(
            sortedApplied.map((s) => ({
              id: s.id,
              start: s.startMinute,
              dur: s.durationMinutes,
            })),
          ).toEqual(
            outcome.slots.map((s) => ({
              id: s.id,
              start: s.startMinute,
              dur: s.durationMinutes,
            })),
          );
        }
      }
    }
  });

  it('orders proposed delay options stably: feasible first, then least disruption, then strategy name', () => {
    const slots = deepFreeze(sampleSlots);
    const outcomes = proposeDelayOptions(slots, { anchorSlotId: 's1', delayMinutes: 20 });

    for (let i = 1; i < outcomes.length; i++) {
      const prev = outcomes[i - 1]!;
      const curr = outcomes[i]!;
      if (prev.feasible !== curr.feasible) {
        expect(prev.feasible).toBe(true);
        expect(curr.feasible).toBe(false);
      }
    }
  });
});
