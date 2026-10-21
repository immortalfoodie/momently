import type { GuestSurgeScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan, Money, PlanPatchOp, Task } from '@/domain/types';
import { getBudgetCap } from '@/engine/budget';
import type { EngineContext } from '@/engine/context';
import { suggestSavings } from '@/engine/guardian';
import { deriveGuestMetrics } from '@/engine/guestMetrics';
import { previewOps } from '@/engine/preview';
import { scoreRisks } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import { buildOption } from './option';
import type { RecoveryOption, ScenarioResult } from './types';

function buildHoldBudgetOption(
  plan: EventPlan,
  newCount: number,
  cap: Money,
  seatingTask: Task,
  seatingNote: string,
  lockedNote: string | undefined,
  ctx: EngineContext,
): RecoveryOption | undefined {
  const preview = previewOps(
    plan,
    [{ type: 'set_guest_count', guestCount: newCount }],
    ctx,
  );
  if (!preview.ok) return undefined;

  const projectedTotal = preview.value.impact.budgetTotalAfter;
  const overBy = Math.max(0, projectedTotal - cap);
  const savingsPlans =
    overBy > 0 ? suggestSavings(preview.value.plan, overBy, {}, ctx) : [];
  const bestSavings = savingsPlans[0];

  const ops: PlanPatchOp[] = [
    { type: 'set_guest_count', guestCount: newCount },
    { type: 'add_task', task: seatingTask },
    ...(bestSavings ? bestSavings.ops : []),
  ];

  return buildOption(
    plan,
    ops,
    {
      id: 'opt_surge_hold_budget',
      label: 'Hold the budget: rebalance and absorb',
      tradeoff: `Accommodates ${newCount} guests within existing cap of ${formatInr(cap)} by rebalancing savings`,
      notes: [
        seatingNote,
        ...(lockedNote ? [lockedNote] : []),
        ...(bestSavings
          ? [
              `Compensating savings: ${bestSavings.levers.map((l) => l.label).join('; ') || 'adjusted'}.`,
            ]
          : []),
      ],
    },
    ctx,
  );
}

function buildRaiseBudgetOption(
  plan: EventPlan,
  newCount: number,
  seatingTask: Task,
  seatingNote: string,
  lockedNote: string | undefined,
  ctx: EngineContext,
): RecoveryOption | undefined {
  const preview = previewOps(
    plan,
    [{ type: 'set_guest_count', guestCount: newCount }],
    ctx,
  );
  if (!preview.ok) return undefined;

  const projectedTotal = preview.value.impact.budgetTotalAfter;
  const raisedCap = Math.ceil(projectedTotal / 1000) * 1000;
  const ops: PlanPatchOp[] = [
    { type: 'set_guest_count', guestCount: newCount },
    { type: 'set_budget_cap', amount: raisedCap },
    { type: 'add_task', task: seatingTask },
  ];

  return buildOption(
    plan,
    ops,
    {
      id: 'opt_surge_raise_budget',
      label: `Raise the budget: expand cap to ${formatInr(raisedCap)}`,
      tradeoff: `Increases budget cap to ${formatInr(raisedCap)} to support all ${newCount} guests at current quality`,
      notes: [
        seatingNote,
        ...(lockedNote ? [lockedNote] : []),
        `Full guest scale applied; rate card per-guest categories expanded monotonically.`,
      ],
    },
    ctx,
  );
}

export function simulateGuestSurge(
  plan: EventPlan,
  input: GuestSurgeScenarioInput,
  ctx: EngineContext,
): ScenarioResult {
  const scoreBefore = scoreRisks(plan, ctx).score;
  const newCount = Math.min(5000, plan.meta.guestCount + input.extraGuests);
  const cap = getBudgetCap(plan.constraints);

  const metricsBefore = deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds);
  const metricsAfter = deriveGuestMetrics(newCount, plan.guestNeeds);
  const seatingNote = `Seating & Catering: tables increase from ${metricsBefore.tables} to ${metricsAfter.tables}; food servings from ${metricsBefore.servings} to ${metricsAfter.servings}.`;

  const lockedItems = plan.budgetItems.filter((i) => i.locked);
  const lockedNote =
    lockedItems.length > 0
      ? `Locked decisions (${lockedItems.map((i) => i.label).join(', ')}) were preserved.`
      : undefined;

  const seatingTask: Task = {
    id: ctx.ids('task'),
    title: `Confirm venue capacity and seating for ${newCount} guests`,
    category: 'venue',
    priority: 'high',
    dueDaysBefore: 14,
    status: 'todo',
  };

  const options: RecoveryOption[] = [];

  if (cap !== null) {
    const optA = buildHoldBudgetOption(
      plan,
      newCount,
      cap,
      seatingTask,
      seatingNote,
      lockedNote,
      ctx,
    );
    if (optA) options.push(optA);
  }

  const optB = buildRaiseBudgetOption(
    plan,
    newCount,
    seatingTask,
    seatingNote,
    lockedNote,
    ctx,
  );
  if (optB) options.push(optB);

  return {
    input,
    applicable: options.length > 0,
    headline: `Guest surge: +${input.extraGuests} surprise attendees (${plan.meta.guestCount} -> ${newCount})`,
    summary: `Evaluate floorplan seating expansion and catering provisions for ${newCount} total guests.`,
    options,
    scoreBefore,
  };
}
