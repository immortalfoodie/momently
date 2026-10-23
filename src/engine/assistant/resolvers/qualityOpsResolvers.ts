import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import { fundUpgrade } from '@/engine/guardian';
import { setItemQuality } from '@/engine/qualityOps';
import { formatInr } from '@/lib/format';
import type { DowngradeIntent, UpgradeIntent } from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

export function listPlanFamilies(plan: EventPlan): string[] {
  const set = new Set<string>();
  for (const item of plan.budgetItems) {
    if (item.rateKey) {
      const fam = item.rateKey.split('.')[0];
      if (fam) set.add(fam);
    }
  }
  return Array.from(set).sort();
}

export function resolveUpgrade(
  plan: EventPlan,
  intent: UpgradeIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const item = plan.budgetItems.find((i) => i.rateKey?.startsWith(`${intent.family}.`));
  if (!item) {
    const available = listPlanFamilies(plan);
    return {
      kind: 'clarify',
      question: `No plannable line item found for "${intent.family}". Available service families: ${available.join(', ')}.`,
    };
  }

  const proposal = fundUpgrade(plan, { family: intent.family, toQuality: intent.toQuality }, ctx);
  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);

  if (proposal.verdict === 'fits') {
    const opt = buildOption(
      plan,
      proposal.upgradeOps,
      {
        id: `opt_upgrade_${intent.family}`,
        label: `Upgrade ${item.label} to ${intent.toQuality}`,
        tradeoff: `Increases quality to ${intent.toQuality}; cost is ${formatInr(proposal.cost)}`,
      },
      ctx,
      false,
      'user',
    );
    const totalAfter = totalBefore + proposal.cost;
    return {
      kind: 'proposal',
      message: `Upgrading ${item.label} to ${intent.toQuality} tier costs ${formatInr(proposal.cost)} and fits within budget. Spend shifts from ${formatInr(totalBefore)} to ${formatInr(totalAfter)}.`,
      options: opt ? [opt] : [],
      recommendedOptionId: opt?.id,
      notes: [],
    };
  }

  if (proposal.verdict === 'needs_funding') {
    const options: RecoveryOption[] = [];
    for (const sp of proposal.fundingOptions) {
      const opt = buildOption(
        plan,
        sp.ops,
        {
          id: `opt_fund_${sp.id}`,
          label: `Upgrade with "${sp.label}" funding`,
          tradeoff: `Upgrades ${item.label} to ${intent.toQuality} and offsets ${formatInr(proposal.shortfall)} deficit via ${sp.levers.length} adjustments`,
        },
        ctx,
        false,
        'user',
      );
      if (opt) options.push(opt);
    }
    return {
      kind: 'proposal',
      message: proposal.message,
      options,
      recommendedOptionId: proposal.recommendedId
        ? `opt_fund_${proposal.recommendedId}`
        : options[0]?.id,
      notes: [],
    };
  }

  return {
    kind: 'conflict',
    message: proposal.message,
    conflicts: [],
    options: [],
  };
}

export function resolveDowngrade(
  plan: EventPlan,
  intent: DowngradeIntent,
  _ctx: EngineContext,
): AssistantOutcome {
  const item = plan.budgetItems.find((i) => i.rateKey?.startsWith(`${intent.family}.`));
  if (!item) {
    const available = listPlanFamilies(plan);
    return {
      kind: 'clarify',
      question: `No plannable line item found for "${intent.family}". Available service families: ${available.join(', ')}.`,
    };
  }

  const stepped = setItemQuality(plan, item, intent.toQuality);
  if (!stepped) {
    return {
      kind: 'clarify',
      question: `Item ${item.label} cannot be changed to ${intent.toQuality} tier (it may be locked or lack a rate card).`,
    };
  }

  const currentTotal = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const currentCost = item.unitCost * item.quantity;
  const savings = Math.max(0, currentCost - stepped.newTotal);
  const totalAfter = Math.max(0, currentTotal - savings);

  const op: PlanPatchOp = {
    type: 'update_budget_item',
    id: item.id,
    changes: stepped.changes,
  };

  const opt = buildOption(
    plan,
    [op],
    {
      id: `opt_downgrade_${intent.family}`,
      label: `Downgrade ${item.label} to ${intent.toQuality}`,
      tradeoff: `Saves ${formatInr(savings)} by shifting ${item.label} to ${intent.toQuality} quality`,
      notes: [`Spend decreases from ${formatInr(currentTotal)} to ${formatInr(totalAfter)}`],
    },
    _ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Downgrading ${item.label} to ${intent.toQuality} saves ${formatInr(savings)}. Spend moves from ${formatInr(currentTotal)} to ${formatInr(totalAfter)}.`,
    options: opt ? [opt] : [],
    notes: [],
  };
}
