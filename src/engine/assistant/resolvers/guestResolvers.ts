import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { simulateGuestSurge } from '@/engine/chaos/guestSurge';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import { checkRequest } from '@/engine/conflicts';
import type { EngineContext } from '@/engine/context';
import { deriveGuestMetrics } from '@/engine/guestMetrics';
import { previewOps } from '@/engine/preview';
import { formatInr } from '@/lib/format';
import type { ChangeGuestCountIntent } from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

function pickSurgeRecommendedId(
  surgeRecommendedId: string | undefined,
  options: RecoveryOption[],
): string | undefined {
  if (surgeRecommendedId) return surgeRecommendedId;
  return options.find((o) => o.meetsCap && !o.id.includes('raise'))?.id ?? options[0]?.id;
}

function buildGuestNotes(plan: EventPlan, targetGuests: number): string[] {
  const mBefore = deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds);
  const mAfter = deriveGuestMetrics(targetGuests, plan.guestNeeds);
  const metricsNote = `Seating & Catering: ${mBefore.tables} -> ${mAfter.tables} tables, ${mBefore.servings} -> ${mAfter.servings} meal servings.`;
  const locked = plan.budgetItems.filter((i) => i.locked || i.provenance === 'user');
  if (locked.length === 0) return [metricsNote];
  return [
    metricsNote,
    `Preserved ${locked.length} locked or host-quoted item(s): ${locked.map((i) => i.label).join(', ')}.`,
  ];
}

export function resolveChangeGuestCount(
  plan: EventPlan,
  intent: ChangeGuestCountIntent,
  ctx: EngineContext,
): AssistantOutcome {
  if (intent.guestCount === plan.meta.guestCount) {
    return {
      kind: 'info',
      message: `Guest count is already ${intent.guestCount}. No changes required.`,
      items: [],
    };
  }

  const op: PlanPatchOp = { type: 'set_guest_count', guestCount: intent.guestCount };
  const checkRes = checkRequest(plan, [op], ctx);
  const notes = buildGuestNotes(plan, intent.guestCount);

  if (checkRes.verdict === 'conflict' && intent.guestCount > plan.meta.guestCount) {
    const diff = intent.guestCount - plan.meta.guestCount;
    const surge = simulateGuestSurge(plan, { type: 'guest_surge', extraGuests: diff }, ctx);
    const options: RecoveryOption[] = surge.options.map((o) => ({
      ...o,
      patch: { ...o.patch, source: 'user' as const },
    }));

    return {
      kind: 'proposal',
      message: `Increasing attendance from ${plan.meta.guestCount} to ${intent.guestCount} guests requires budget adjustments.`,
      options,
      recommendedOptionId: pickSurgeRecommendedId(surge.recommendedOptionId, options),
      notes: [surge.summary, ...notes],
    };
  }

  const preview = previewOps(plan, [op], ctx);
  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const totalAfter = preview.ok ? preview.value.impact.budgetTotalAfter : totalBefore;

  const opt = buildOption(
    plan,
    [op],
    {
      id: 'opt_change_guests',
      label: `Update attendance to ${intent.guestCount} guests`,
      tradeoff: `Adjusts scale-dependent lines from ${plan.meta.guestCount} to ${intent.guestCount} guests`,
      notes,
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Proposed changing guest count from ${plan.meta.guestCount} to ${intent.guestCount}. Estimated spend shifts from ${formatInr(totalBefore)} to ${formatInr(totalAfter)}.`,
    options: opt ? [opt] : [],
    notes,
  };
}
