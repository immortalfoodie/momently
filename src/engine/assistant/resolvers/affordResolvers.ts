import { getRate } from '@/data/rateCards';
import { getTemplate } from '@/data/templates';
import type { BudgetItem, EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import { assessAddition, suggestSavings } from '@/engine/guardian';
import { itemFromRate, tierForCity } from '@/engine/pricing';
import { formatInr } from '@/lib/format';
import type { AffordCheckIntent } from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

function deriveAdditionItem(
  plan: EventPlan,
  intent: AffordCheckIntent,
  ctx: EngineContext,
): { item?: BudgetItem; note?: string; clarify?: string } {
  if (!intent.family && intent.userStatedCost === null) {
    return {
      clarify:
        'Could you specify which item or service you would like to afford, and an estimated cost if you have one?',
    };
  }

  if (intent.userStatedCost !== null) {
    const costSourceNote = `Based on your host-quoted cost of ${formatInr(intent.userStatedCost)}.`;
    return {
      item: {
        id: ctx.ids('item'),
        category: 'other',
        label: intent.description,
        basis: 'flat',
        unitCost: intent.userStatedCost,
        quantity: 1,
        provenance: 'user',
        locked: true,
        note: costSourceNote,
      },
      note: costSourceNote,
    };
  }

  if (intent.family) {
    const tier = tierForCity(plan.meta.city);
    const template = getTemplate(plan.meta.type);
    const rate = getRate(intent.family, 'standard') ?? getRate(intent.family, 'essential');
    if (!rate) {
      return {
        clarify: `No rate card available for family "${intent.family}". Please specify an estimated cost.`,
      };
    }
    const mult = template.categoryMultipliers?.[rate.category] ?? 1;
    const computed = itemFromRate(rate, {
      guestCount: plan.meta.guestCount,
      tier,
      categoryMultiplier: mult,
    });
    const costSourceNote = `Estimated at ${formatInr(computed.unitCost)} (standard benchmark quote, subject to vendor confirmation).`;
    return {
      item: {
        id: ctx.ids('item'),
        category: rate.category,
        label: rate.label,
        basis: 'flat',
        unitCost: computed.unitCost,
        quantity: 1,
        provenance: 'estimate',
        locked: false,
        note: costSourceNote,
      },
      note: costSourceNote,
    };
  }

  return {
    clarify: 'Please provide either an estimated price or an established service category.',
  };
}

function buildAffordFundingOptions(
  plan: EventPlan,
  additionItem: BudgetItem,
  shortfall: Money,
  costSourceNote: string,
  ctx: EngineContext,
): RecoveryOption[] {
  const tempPlan: EventPlan = {
    ...plan,
    budgetItems: [...plan.budgetItems, additionItem],
  };
  const savingsPlans = suggestSavings(tempPlan, shortfall, {}, ctx);
  const options: RecoveryOption[] = [];
  for (const sp of savingsPlans) {
    const allOps: PlanPatchOp[] = [{ type: 'add_budget_item', item: additionItem }, ...sp.ops];
    const opt = buildOption(
      plan,
      allOps,
      {
        id: `opt_fund_afford_${sp.id}`,
        label: `Fund ${additionItem.label} via ${sp.label}`,
        tradeoff: `Offsets ${formatInr(shortfall)} via ${sp.levers.length} adjustments`,
        notes: [costSourceNote, ...sp.levers.map((l) => l.label)],
      },
      ctx,
      false,
      'user',
    );
    if (opt) options.push(opt);
  }
  return options;
}

export function resolveAffordCheck(
  plan: EventPlan,
  intent: AffordCheckIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const derived = deriveAdditionItem(plan, intent, ctx);
  if (derived.clarify || !derived.item || !derived.note) {
    return { kind: 'clarify', question: derived.clarify ?? 'Invalid addition request' };
  }

  const { item, note } = derived;
  const assessment = assessAddition(plan, item, ctx);
  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);

  if (assessment.fits) {
    const opt = buildOption(
      plan,
      [{ type: 'add_budget_item', item }],
      {
        id: 'opt_afford_addition',
        label: `Add ${item.label} (${formatInr(item.unitCost)})`,
        tradeoff: 'Adds line item without requiring compensatory cuts',
        notes: [note],
      },
      ctx,
      false,
      'user',
    );
    return {
      kind: 'proposal',
      message: `Yes, you can afford ${item.label}! ${note} Expenditure shifts from ${formatInr(totalBefore)} to ${formatInr(assessment.newTotal)}.`,
      options: opt ? [opt] : [],
      notes: [note],
    };
  }

  const shortfall = assessment.overBy;
  const options = buildAffordFundingOptions(plan, item, shortfall, note, ctx);

  return {
    kind: 'conflict',
    message: `Adding ${item.label} (${formatInr(item.unitCost)}) exceeds the budget cap by ${formatInr(shortfall)}. ${note}`,
    conflicts: [],
    options,
  };
}
