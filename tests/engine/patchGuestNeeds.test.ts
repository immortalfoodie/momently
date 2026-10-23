import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import { createPlan } from '@/engine/planFactory';
import { reducePatchOp } from '@/engine/patchOps';
import { createIdFactory } from '@/lib/id';

describe('Patch Ops: Guest Needs & Headcount Clamping', () => {
  const ids = createIdFactory('test_guest_patch');
  const clock = () => new Date('2026-10-21T12:00:00.000Z');

  function makeTestPlan(): EventPlan {
    const { plan } = createPlan({
      meta: {
        ...DEMO_SCENARIO.meta,
        guestCount: 80,
      },
      constraints: DEMO_SCENARIO.constraints,
      ids,
      clock,
    });

    return {
      ...plan,
      guestNeeds: {
        vegetarian: 40,
        jain: 15,
        vegan: 5,
        glutenFree: 2,
        allergyAlerts: 1,
        wheelchairUsers: 2,
        elderly: 10,
        children: 8,
        quietSpaceNeeded: true,
        languages: ['English', 'Hindi'],
      },
    };
  }

  describe('set_guest_needs op', () => {
    it('successfully updates partial guest needs', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'set_guest_needs',
          changes: { wheelchairUsers: 4, quietSpaceNeeded: false },
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.plan.guestNeeds.wheelchairUsers).toBe(4);
        expect(res.value.plan.guestNeeds.quietSpaceNeeded).toBe(false);
        expect(res.value.plan.guestNeeds.vegetarian).toBe(40);
      }
    });

    it('rejects counts exceeding meta.guestCount with invalid_change and field-specific message', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'set_guest_needs',
          changes: { wheelchairUsers: 85 },
        },
        ids,
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_change');
        expect(res.error.message).toBe("Wheelchair users can't be more than your guest count of 80");
      }
    });
  });

  describe('set_guest_count clamping consistency rule', () => {
    it('clamps guest needs exceeding the new count and reports clamped fields in notes', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'set_guest_count',
          guestCount: 12,
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.plan.meta.guestCount).toBe(12);
        expect(res.value.plan.guestNeeds.vegetarian).toBe(12);
        expect(res.value.plan.guestNeeds.jain).toBe(12);
        expect(res.value.plan.guestNeeds.elderly).toBe(10);
        expect(res.value.notes.some((n) => n.includes('Guest needs clamped to new count:'))).toBe(true);
        expect(res.value.notes.some((n) => n.includes('Vegetarians, Jain guests'))).toBe(true);
      }
    });

    it('does not add a clamping note when all guest counts are already within the new count', () => {
      const plan = makeTestPlan();
      const res = reducePatchOp(
        plan,
        {
          type: 'set_guest_count',
          guestCount: 50,
        },
        ids,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.notes.some((n) => n.includes('clamped'))).toBe(false);
      }
    });
  });
});
