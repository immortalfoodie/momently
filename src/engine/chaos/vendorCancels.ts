import type { VendorCancelsScenarioInput } from '@/domain/chaosSchemas';
import type { BudgetItem, EventPlan, PlanPatchOp } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { stepItemQuality } from '@/engine/levers';
import { scoreRisks } from '@/engine/risk';
import { buildOption } from './option';
import type { RecoveryOption, ScenarioResult } from './types';
import {
  buildCancelItemOps,
  buildCriteriaNotes,
  buildRecoveryTasks,
  findMatchingItem,
  findMatchingVendor,
} from './vendorCancelsHelpers';

function buildLowerTierVendorOption(
  plan: EventPlan,
  matchingItem: BudgetItem,
  taskOps: PlanPatchOp[],
  criteriaNotes: string[],
  ctx: EngineContext,
): RecoveryOption | undefined {
  const stepDown = stepItemQuality(plan, matchingItem, 'down');
  if (!stepDown) return undefined;

  const ops: PlanPatchOp[] = [
    ...(matchingItem.locked
      ? [
          {
            type: 'update_budget_item' as const,
            id: matchingItem.id,
            changes: { locked: false },
          },
        ]
      : []),
    {
      type: 'update_budget_item',
      id: matchingItem.id,
      changes: {
        ...stepDown.changes,
        provenance: 'estimate',
        note: 'Vendor cancelled - stepped down',
      },
    },
    ...taskOps,
  ];

  return buildOption(
    plan,
    ops,
    {
      id: 'opt_vendor_lower_tier',
      label: `Replace at lower tier: budget relief`,
      tradeoff: `Steps down ${matchingItem.label} to save budget while re-tendering`,
      notes: criteriaNotes,
    },
    ctx,
    true,
  );
}

export function simulateVendorCancels(
  plan: EventPlan,
  input: VendorCancelsScenarioInput,
  ctx: EngineContext,
): ScenarioResult {
  const scoreBefore = scoreRisks(plan, ctx).score;
  const vendor = findMatchingVendor(plan, input.category);

  if (!vendor) {
    const known = plan.vendors.map((v) => v.category).join(', ') || 'none';
    return {
      input,
      applicable: false,
      headline: `Vendor category "${input.category}" not found in event plan`,
      summary: `Known active vendor categories: ${known}.`,
      options: [],
      scoreBefore,
    };
  }

  const matchingItem = findMatchingItem(plan, vendor);
  const daysAway = plan.meta.dateIso
    ? Math.max(
        1,
        Math.floor(
          (new Date(plan.meta.dateIso).getTime() - ctx.clock().getTime()) / 86400000,
        ),
      )
    : 30;

  const tasks = buildRecoveryTasks(vendor, daysAway, ctx);
  const taskOps: PlanPatchOp[] = tasks.map((t) => ({ type: 'add_task', task: t }));
  const itemOps = buildCancelItemOps(matchingItem);
  const criteriaNotes = buildCriteriaNotes(vendor, plan.meta.type, daysAway);

  const options: RecoveryOption[] = [];

  const optA = buildOption(
    plan,
    [...itemOps, ...taskOps],
    {
      id: 'opt_vendor_like_for_like',
      label: `Replace like-for-like: re-tender ${vendor.category}`,
      tradeoff: `Maintains allocated budget for ${vendor.category} and issues replacement checklist`,
      notes: criteriaNotes,
    },
    ctx,
    true,
  );
  if (optA) options.push(optA);

  if (matchingItem) {
    const optB = buildLowerTierVendorOption(
      plan,
      matchingItem,
      taskOps,
      criteriaNotes,
      ctx,
    );
    if (optB) options.push(optB);
  }

  return {
    input,
    applicable: options.length > 0,
    headline: `Critical vendor cancellation: ${vendor.category}`,
    summary: `Re-source replacement providers for ${vendor.category} with structured quotes and due-diligence checks.`,
    options,
    scoreBefore,
  };
}
