import { describe, expect, it } from 'vitest';
import { BUDGET_CATEGORY_IDS, EVENT_TYPE_IDS } from '@/domain/constants';
import { eventPlanSchema } from '@/domain/schemas';
import type { EventPlan, EventSetting, EventType, PlanPatchOp } from '@/domain/types';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import { applyPatch, createPatch } from '@/engine/patch';
import { createPlan } from '@/engine/planFactory';
import { createIdFactory } from '@/lib/id';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

const SETTINGS: readonly EventSetting[] = ['indoor', 'outdoor', 'mixed', 'undecided'];
const NON_CONTINGENCY_CATEGORIES = BUDGET_CATEGORY_IDS.filter((c) => c !== 'contingency');

function buildAddOrRemoveItemOp(
  plan: EventPlan,
  rng: () => number,
  seqId: () => string,
): PlanPatchOp {
  const removable = plan.budgetItems.filter((i) => i.category !== 'contingency' && !i.locked);
  if (rng() < 0.5 && removable.length > 2) {
    const target = pick(rng, removable);
    return { type: 'remove_budget_item', id: target.id };
  }
  return {
    type: 'add_budget_item',
    item: {
      id: seqId(),
      category: pick(rng, NON_CONTINGENCY_CATEGORIES),
      label: 'Custom Studio Line',
      basis: rng() < 0.5 ? 'flat' : 'per_guest',
      unitCost: randInt(rng, 500, 15000),
      quantity: 1,
      provenance: 'user',
      locked: false,
    },
  };
}

function buildTaskOp(plan: EventPlan, rng: () => number, seqId: () => string): PlanPatchOp {
  if (rng() < 0.5 && plan.tasks.length > 0) {
    const task = pick(rng, plan.tasks);
    return { type: 'update_task', id: task.id, changes: { status: 'done' } };
  }
  return {
    type: 'add_task',
    task: {
      id: seqId(),
      title: 'Confirm logistics milestone',
      category: 'planning',
      dueDaysBefore: randInt(rng, 1, 90),
      status: 'todo',
      priority: pick(rng, ['low', 'medium', 'high'] as const),
    },
  };
}

function buildRandomOp(plan: EventPlan, rng: () => number, seqId: () => string): PlanPatchOp {
  const kind = randInt(rng, 0, 6);
  if (kind === 0) return { type: 'set_guest_count', guestCount: randInt(rng, 20, 200) };
  if (kind === 1) {
    return {
      type: 'scale_category',
      category: pick(rng, NON_CONTINGENCY_CATEGORIES),
      percent: randInt(rng, -30, 30),
    };
  }
  if (kind === 2) return buildAddOrRemoveItemOp(plan, rng, seqId);
  if (kind === 3) {
    const target = pick(
      rng,
      plan.budgetItems.filter((i) => i.category !== 'contingency'),
    );
    return { type: 'update_budget_item', id: target.id, changes: { locked: !target.locked } };
  }
  if (kind === 4 && plan.schedule.length > 0) {
    const slot = pick(rng, plan.schedule);
    const maxDur = Math.min(240, 1440 - slot.startMinute);
    return {
      type: 'update_slot',
      id: slot.id,
      changes: { durationMinutes: randInt(rng, 15, Math.max(15, maxDur)) },
    };
  }
  if (kind === 5) return buildTaskOp(plan, rng, seqId);
  return { type: 'set_setting', setting: pick(rng, SETTINGS) };
}

function assertLockedItemsPreserved(
  before: EventPlan,
  after: EventPlan,
  op: PlanPatchOp,
  contextMsg: string,
): void {
  const explicitlyUnlockedIds = new Set<string>();
  if (op.type === 'update_budget_item' && op.changes.locked === false) {
    explicitlyUnlockedIds.add(op.id);
  }
  for (const prevItem of before.budgetItems) {
    if (prevItem.locked && !explicitlyUnlockedIds.has(prevItem.id)) {
      const nextItem = after.budgetItems.find((i) => i.id === prevItem.id);
      expect(nextItem, `${contextMsg}: locked item ${prevItem.id} disappeared`).toBeDefined();
      expect(nextItem?.unitCost, `${contextMsg}: locked item ${prevItem.id} unitCost changed`).toBe(
        prevItem.unitCost,
      );
      expect(nextItem?.quantity, `${contextMsg}: locked item ${prevItem.id} quantity changed`).toBe(
        prevItem.quantity,
      );
    }
  }
}

function assertScheduleAndMoneyBounds(after: EventPlan, contextMsg: string): void {
  for (const item of after.budgetItems) {
    expect(
      Number.isInteger(item.unitCost) && item.unitCost >= 0,
      `${contextMsg}: non-integer or negative unitCost on ${item.id}`,
    ).toBe(true);
  }
  for (const slot of after.schedule) {
    expect(
      slot.startMinute >= 0 && slot.startMinute <= 1439,
      `${contextMsg}: slot ${slot.id} startMinute out of 0..1439`,
    ).toBe(true);
    expect(
      slot.startMinute + slot.durationMinutes <= 1440,
      `${contextMsg}: slot ${slot.id} exceeds midnight (1440)`,
    ).toBe(true);
  }
}

function assertPlanInvariants(
  before: EventPlan,
  after: EventPlan,
  op: PlanPatchOp,
  contextMsg: string,
): void {
  expect(eventPlanSchema.safeParse(after).success, `${contextMsg}: schema validation failed`).toBe(
    true,
  );
  expect(after.version, `${contextMsg}: version did not increment by 1`).toBe(before.version + 1);
  assertLockedItemsPreserved(before, after, op, contextMsg);

  const contingencyItems = after.budgetItems.filter((i) => i.category === 'contingency');
  expect(contingencyItems.length, `${contextMsg}: expected exactly 1 contingency item`).toBe(1);
  assertScheduleAndMoneyBounds(after, contextMsg);

  const total = budgetTotal(after.budgetItems, after.meta.guestCount);
  expect(Number.isInteger(total) && total >= 0, `${contextMsg}: invalid budgetTotal`).toBe(true);

  const hardCap = getBudgetCap(after.constraints);
  if (hardCap !== null) {
    expect(total <= hardCap, `${contextMsg}: total ${total} exceeded hard cap ${hardCap}`).toBe(
      true,
    );
  }
}

describe('Engine Seeded Property Invariants (100 sequences)', () => {
  const clock = () => new Date('2026-10-21T12:00:00.000Z');

  it('maintains all structural, financial, lock, schedule, and cap invariants across 100 random edit sequences', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      const ids = createIdFactory(`inv_${seed}`);
      const ctx = { ids, clock };
      const eventType: EventType = EVENT_TYPE_IDS[(seed - 1) % EVENT_TYPE_IDS.length]!;

      const initialGuestCount = randInt(rng, 40, 120);
      const basePlan = createPlan({
        meta: {
          title: `Seeded ${eventType} #${seed}`,
          type: eventType,
          city: pick(rng, ['Mumbai', 'Pune', 'Jaipur', 'Udaipur']),
          dateIso: '2026-12-15',
          guestCount: initialGuestCount,
          setting: pick(rng, SETTINGS),
          hostBrief: 'Seeded invariant test celebration',
        },
        constraints: [],
        ids,
        clock,
      }).plan;

      // Attach a realistic hard budget cap (+40% headroom over initial total)
      const initialTotal = budgetTotal(basePlan.budgetItems, basePlan.meta.guestCount);
      const capAmount = Math.round(initialTotal * 1.4);
      let currentPlan: EventPlan = {
        ...basePlan,
        constraints: [
          {
            id: ids('c'),
            kind: 'budget_cap',
            severity: 'hard',
            description: 'Hard celebration cap',
            numericValue: capAmount,
          },
        ],
      };

      const steps = randInt(rng, 6, 12);
      for (let step = 1; step <= steps; step++) {
        const contextMsg = `[seed=${seed}, eventType=${eventType}, step=${step}]`;
        const op = buildRandomOp(currentPlan, rng, () => ids('custom'));
        const patch = createPatch([op], `Step ${step}`, 'user', ids, clock, 'approved');
        const snapshotJson = JSON.stringify(currentPlan);

        const res = applyPatch(currentPlan, patch, ctx);
        if (res.ok) {
          assertPlanInvariants(currentPlan, res.value.plan, op, contextMsg);
          currentPlan = res.value.plan;
        } else {
          expect(
            JSON.stringify(currentPlan),
            `${contextMsg}: failed patch mutated input plan`,
          ).toBe(snapshotJson);
        }
      }
    }
  });
});
