import { HIGH_IMPACT_FAMILIES } from '@/data/impactWeights';
import type { BudgetCutScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import type { EngineContext } from '@/engine/context';
import { suggestSavings } from '@/engine/guardian';
import { previewOps } from '@/engine/preview';
import { scoreRisks } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import { buildOption } from './option';
import type { RecoveryOption, ScenarioResult } from './types';

export function findMaxGuestsForCap(plan: EventPlan, newCap: Money, ctx: EngineContext): number {
  let low = 1;
  let high = plan.meta.guestCount - 1;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testOps: PlanPatchOp[] = [
      { type: 'set_budget_cap', amount: newCap },
      { type: 'set_guest_count', guestCount: mid },
    ];
    const preview = previewOps(plan, testOps, ctx);

    if (preview.ok && preview.value.impact.budgetTotalAfter <= newCap) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

export function buildProtectOption(
  plan: EventPlan,
  targetSavings: Money,
  newCap: Money,
  cap: Money,
  percent: number,
  ctx: EngineContext,
  source: 'user' | 'ai' | 'chaos' = 'chaos',
): RecoveryOption | undefined {
  const plans = suggestSavings(
    plan,
    targetSavings,
    { protectedFamilies: [...HIGH_IMPACT_FAMILIES] },
    ctx,
  );
  const sp = plans.find((p) => p.id === 'protect_the_experience') ?? plans[0];
  if (!sp) return undefined;

  const ops: PlanPatchOp[] = [{ type: 'set_budget_cap', amount: newCap }, ...sp.ops];
  return buildOption(
    plan,
    ops,
    {
      id: 'opt_cut_protect_exp',
      label: 'Protect the experience: targeted savings',
      tradeoff: `Absorbs ${percent}% cut (${formatInr(cap - newCap)}) by trimming lower-visibility categories`,
      notes: [
        `Protected centerpieces: ${HIGH_IMPACT_FAMILIES.join(', ')}.`,
        `Cut selections: ${sp.levers.map((l) => l.label).join('; ') || 'reallocated'}.`,
      ],
    },
    ctx,
    false,
    source,
  );
}

export function buildFewestOption(
  plan: EventPlan,
  targetSavings: Money,
  newCap: Money,
  ctx: EngineContext,
  source: 'user' | 'ai' | 'chaos' = 'chaos',
): RecoveryOption | undefined {
  const plans = suggestSavings(plan, targetSavings, {}, ctx);
  const sp = plans.find((p) => p.id === 'fewest_changes') ?? plans[0];
  if (!sp) return undefined;

  const ops: PlanPatchOp[] = [{ type: 'set_budget_cap', amount: newCap }, ...sp.ops];
  return buildOption(
    plan,
    ops,
    {
      id: 'opt_cut_fewest_changes',
      label: 'Fewest changes: high-value reductions',
      tradeoff: `Absorbs cut using ${sp.levers.length} large single-item reductions`,
      notes: [
        `Selected levers: ${sp.levers.map((l) => l.label).join('; ') || 'adjusted items'}.`,
      ],
    },
    ctx,
    false,
    source,
  );
}

export function buildResizeOption(
  plan: EventPlan,
  newCap: Money,
  ctx: EngineContext,
  source: 'user' | 'ai' | 'chaos' = 'chaos',
): RecoveryOption | undefined {
  const maxGuests = findMaxGuestsForCap(plan, newCap, ctx);
  if (maxGuests <= 0 || maxGuests >= plan.meta.guestCount) return undefined;

  const ops: PlanPatchOp[] = [
    { type: 'set_budget_cap', amount: newCap },
    { type: 'set_guest_count', guestCount: maxGuests },
  ];
  return buildOption(
    plan,
    ops,
    {
      id: 'opt_cut_smaller_guests',
      label: `Smaller guest list: resize to ${maxGuests} guests`,
      tradeoff: `Trims attendance from ${plan.meta.guestCount} to ${maxGuests} to maintain premium quality under new cap`,
      notes: [
        `Preserves 100% of vendor quality, decor styling, and experience tiers without downgrading any line items.`,
        `Headcount reduced by ${plan.meta.guestCount - maxGuests} guests.`,
      ],
    },
    ctx,
    false,
    source,
  );
}

export function simulateBudgetCut(
  plan: EventPlan,
  input: BudgetCutScenarioInput,
  ctx: EngineContext,
): ScenarioResult {
  const scoreBefore = scoreRisks(plan, ctx).score;
  const cap = getBudgetCap(plan.constraints);

  if (cap === null) {
    return {
      input,
      applicable: false,
      headline: 'Budget cut scenario requires an active budget cap',
      summary:
        'Please add a hard budget cap to the event before testing budget cut simulations.',
      options: [],
      scoreBefore,
    };
  }

  const newCap = Math.floor((cap * (100 - input.percent)) / 100);
  const currentTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const targetSavings = Math.max(0, currentTotal - newCap);
  const options: RecoveryOption[] = [];

  const optA = buildProtectOption(plan, targetSavings, newCap, cap, input.percent, ctx);
  if (optA) options.push(optA);

  const optB = buildFewestOption(plan, targetSavings, newCap, ctx);
  if (optB) options.push(optB);

  const optC = buildResizeOption(plan, newCap, ctx);
  if (optC) options.push(optC);

  return {
    input,
    applicable: options.length > 0,
    headline: `Sudden ${input.percent}% budget reduction (Cap: ${formatInr(cap)} -> ${formatInr(newCap)})`,
    summary: `Evaluate cost-saving strategies to absorb a ${formatInr(cap - newCap)} budget reduction without compromising the celebration.`,
    options,
    scoreBefore,
  };
}
