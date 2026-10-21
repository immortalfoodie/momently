import { getTemplate } from '@/data/templates';
import type { ItemUnavailableScenarioInput } from '@/domain/chaosSchemas';
import type { BudgetItem, EventPlan, PlanPatchOp } from '@/domain/types';
import { itemTotal } from '@/engine/budget';
import type { EngineContext } from '@/engine/context';
import { qualityOfItem, stepItemQuality } from '@/engine/levers';
import { scoreRisks } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import { buildOption } from './option';
import type { RecoveryOption, ScenarioResult } from './types';

const AI_SUBSTITUTE_NOTE =
  'Theme-preserving substitutes will be suggested by the AI layer; the deterministic engine handles the cost and structure.';

function buildStepOption(
  plan: EventPlan,
  item: BudgetItem,
  direction: 'up' | 'down',
  ctx: EngineContext,
): RecoveryOption | undefined {
  const evaluateItem = item.locked ? { ...item, locked: false } : item;
  const step = stepItemQuality(plan, evaluateItem, direction);
  if (!step) return undefined;

  const currentCost = itemTotal(item, plan.meta.guestCount);
  const costDiff = step.newTotal - currentCost;
  const targetQ = qualityOfItem({ ...item, ...step.changes }) ?? 'alternate tier';

  const ops: PlanPatchOp[] = [];
  if (item.locked) {
    ops.push({ type: 'update_budget_item', id: item.id, changes: { locked: false } });
  }
  ops.push({ type: 'update_budget_item', id: item.id, changes: step.changes });

  const diffText =
    costDiff > 0
      ? `increases cost by ${formatInr(costDiff)}`
      : costDiff < 0
        ? `saves ${formatInr(Math.abs(costDiff))}`
        : 'at identical cost';

  return buildOption(
    plan,
    ops,
    {
      id: `opt_item_${direction}_${item.id}`,
      label: `Re-source at ${targetQ}: ${step.changes.label}`,
      tradeoff: `Switches inventory to ${targetQ} tier (${diffText})`,
      notes: [
        `Replaced unavailable inventory for ${item.label} with ${targetQ} option.`,
        AI_SUBSTITUTE_NOTE,
      ],
    },
    ctx,
  );
}

export function simulateItemUnavailable(
  plan: EventPlan,
  input: ItemUnavailableScenarioInput,
  ctx: EngineContext,
): ScenarioResult {
  const scoreBefore = scoreRisks(plan, ctx).score;
  const matchingItems = plan.budgetItems.filter((i) =>
    i.rateKey?.startsWith(`${input.family}.`),
  );

  if (matchingItems.length === 0) {
    return {
      input,
      applicable: false,
      headline: `Item family "${input.family}" not found in current event budget`,
      summary:
        'Please verify the rate family identifier in the active budget line items.',
      options: [],
      scoreBefore,
    };
  }

  const template = getTemplate(plan.meta.type);
  const isRequired = template.lineItems.some(
    (li) => li.family === input.family && li.required,
  );
  const options: RecoveryOption[] = [];

  for (const item of matchingItems) {
    const optDown = buildStepOption(plan, item, 'down', ctx);
    if (optDown) options.push(optDown);

    const optUp = buildStepOption(plan, item, 'up', ctx);
    if (optUp) options.push(optUp);

    if (!isRequired) {
      const savings = itemTotal(item, plan.meta.guestCount);
      const opsDrop: PlanPatchOp[] = [{ type: 'remove_budget_item', id: item.id }];
      const optDrop = buildOption(
        plan,
        opsDrop,
        {
          id: `opt_item_drop_${item.id}`,
          label: `Drop and reallocate: remove ${item.label}`,
          tradeoff: `Removes optional ${item.label} to save ${formatInr(savings)}`,
          notes: [
            `Item family ${input.family} is optional in the ${template.label} template.`,
            AI_SUBSTITUTE_NOTE,
          ],
        },
        ctx,
      );
      if (optDrop) options.push(optDrop);
    }
  }

  return {
    input,
    applicable: options.length > 0,
    headline: `Inventory unavailable: ${input.family}`,
    summary: `Evaluate tier substitutions or optional line-item removals to resolve unavailable inventory.`,
    options,
    scoreBefore,
  };
}
