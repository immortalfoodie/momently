import type { EventPlan } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import { suggestSavings } from '@/engine/guardian';
import { formatInr } from '@/lib/format';
import type { SaveMoneyIntent } from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

export function resolveSaveMoney(
  plan: EventPlan,
  intent: SaveMoneyIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const plans = suggestSavings(plan, intent.amount, {}, ctx);
  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const options: RecoveryOption[] = [];

  for (const sp of plans) {
    const opt = buildOption(
      plan,
      sp.ops,
      {
        id: `opt_save_${sp.id}`,
        label: `${sp.label} (save ${formatInr(sp.achieved)})`,
        tradeoff: `Reduces budget from ${formatInr(totalBefore)} via ${sp.levers.length} adjustments`,
        notes: sp.met
          ? [`Target achieved: saved ${formatInr(sp.achieved)}`, ...sp.levers.map((l) => l.label)]
          : [
              `Shortfall of ${formatInr(intent.amount - sp.achieved)}: saved ${formatInr(sp.achieved)} of requested ${formatInr(intent.amount)}`,
              ...sp.levers.map((l) => l.label),
            ],
      },
      ctx,
      false,
      'user',
    );
    if (opt) options.push(opt);
  }

  const protectPlan = plans.find((p) => p.id === 'protect_experience' && p.met);
  const recommendedId = protectPlan?.id ?? plans[0]?.id;

  return {
    kind: 'proposal',
    message: `Generated ${options.length} savings strategies targeting ${formatInr(intent.amount)}. Current expenditure is ${formatInr(totalBefore)}.`,
    options,
    recommendedOptionId: recommendedId ? `opt_save_${recommendedId}` : undefined,
    notes: [],
  };
}
