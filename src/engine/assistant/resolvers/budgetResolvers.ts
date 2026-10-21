import type { EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import {
  buildFewestOption,
  buildProtectOption,
  buildResizeOption,
} from '@/engine/chaos/budgetCut';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import { findConflicts } from '@/engine/conflicts';
import type { EngineContext } from '@/engine/context';
import { maxGuestsWithinCap, minimumFeasibleCost } from '@/engine/feasibility';
import { previewOps } from '@/engine/preview';
import { formatInr } from '@/lib/format';
import type { ChangeBudgetIntent } from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

function buildFloorConflictOutcome(
  plan: EventPlan,
  amount: Money,
  floor: Money,
  ctx: EngineContext,
): AssistantOutcome {
  const maxG = maxGuestsWithinCap(plan.meta, amount, plan.guestNeeds, ctx);
  const options: RecoveryOption[] = [];

  const optFloor = buildOption(
    plan,
    [{ type: 'set_budget_cap', amount: floor }],
    {
      id: 'opt_raise_cap_to_floor',
      label: `Raise budget cap to ${formatInr(floor)}`,
      tradeoff: 'Matches budget to absolute minimum essential event baseline',
    },
    ctx,
    false,
    'user',
  );
  if (optFloor) options.push(optFloor);

  if (maxG > 0) {
    const optShrink = buildOption(
      plan,
      [
        { type: 'set_budget_cap', amount },
        { type: 'set_guest_count', guestCount: maxG },
      ],
      {
        id: 'opt_reduce_guests_to_cap',
        label: `Reduce guest count to ${maxG}`,
        tradeoff: `Reduces attendance from ${plan.meta.guestCount} to fit within ${formatInr(amount)}`,
      },
      ctx,
      false,
      'user',
    );
    if (optShrink) options.push(optShrink);
  }

  return {
    kind: 'conflict',
    message: `Budget cap of ${formatInr(amount)} is below the minimum essential floor of ${formatInr(floor)}.`,
    conflicts: findConflicts(
      {
        ...plan,
        constraints: [
          ...plan.constraints.filter((c) => c.kind !== 'budget_cap'),
          {
            id: 'temp_cap',
            kind: 'budget_cap',
            severity: 'hard',
            description: 'cap',
            numericValue: amount,
          },
        ],
      },
      ctx,
    ),
    options,
  };
}

function buildLowerBudgetProposal(
  plan: EventPlan,
  amount: Money,
  currentTotal: Money,
  ctx: EngineContext,
): AssistantOutcome {
  const targetSavings = currentTotal - amount;
  const currentCap = getBudgetCap(plan.constraints) ?? currentTotal;
  const pct = currentCap > 0 ? Math.round((targetSavings / currentCap) * 100) : 10;
  const options: RecoveryOption[] = [];

  const optA = buildProtectOption(plan, targetSavings, amount, currentCap, pct, ctx, 'user');
  if (optA) options.push(optA);
  const optB = buildFewestOption(plan, targetSavings, amount, ctx, 'user');
  if (optB) options.push(optB);
  const optC = buildResizeOption(plan, amount, ctx, 'user');
  if (optC) options.push(optC);

  return {
    kind: 'proposal',
    message: `Lowering the budget cap to ${formatInr(amount)} requires ${formatInr(targetSavings)} in reductions. Proposed 3 balanced reduction paths:`,
    options,
    recommendedOptionId: options[0]?.id,
    notes: [],
  };
}

function createBudgetConstraintOps(
  plan: EventPlan,
  intent: ChangeBudgetIntent,
  ctx: EngineContext,
): PlanPatchOp[] {
  if (intent.hard) {
    return [{ type: 'set_budget_cap', amount: intent.amount }];
  }
  const ops: PlanPatchOp[] = [];
  const existingCap = plan.constraints.find((c) => c.kind === 'budget_cap');
  if (existingCap) ops.push({ type: 'remove_constraint', id: existingCap.id });
  ops.push({
    type: 'add_constraint',
    constraint: {
      id: ctx.ids('constraint'),
      kind: 'budget_cap',
      severity: 'soft',
      description: `Budget target of ${formatInr(intent.amount)} (flexible target)`,
      numericValue: intent.amount,
    },
  });
  return ops;
}

export function resolveChangeBudget(
  plan: EventPlan,
  intent: ChangeBudgetIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const floor = minimumFeasibleCost(plan.meta, plan.guestNeeds, ctx);
  if (intent.amount < floor) {
    return buildFloorConflictOutcome(plan, intent.amount, floor, ctx);
  }

  const currentTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  if (intent.amount < currentTotal) {
    return buildLowerBudgetProposal(plan, intent.amount, currentTotal, ctx);
  }

  const ops = createBudgetConstraintOps(plan, intent, ctx);
  const preview = previewOps(plan, ops, ctx);
  const totalAfter = preview.ok ? preview.value.impact.budgetTotalAfter : currentTotal;
  const opt = buildOption(
    plan,
    ops,
    {
      id: 'opt_change_budget',
      label: `Update budget to ${formatInr(intent.amount)}`,
      tradeoff: 'Modifies budget ceiling without altering line item specifications',
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Proposed updating budget cap to ${formatInr(intent.amount)} (${intent.hard ? 'strict limit' : 'flexible target'}). Spend ceiling moves from ${formatInr(currentTotal)} to ${formatInr(totalAfter)}.`,
    options: opt ? [opt] : [],
    notes: [],
  };
}

