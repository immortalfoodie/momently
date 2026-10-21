import { familyForText } from '@/data/familyKeywords';
import { getRate } from '@/data/rateCards';
import { getTemplate } from '@/data/templates';
import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { itemTotal } from './budget';
import type { Conflict, ResolutionOption } from './conflicts';
import { MONSOON_MONTHS } from './conflicts';
import type { EngineContext } from './context';
import { itemFromRate, tierForCity } from './pricing';

/**
 * Checks if mandatory host must-have items are absent from the active budget.
 * WHY: Warns hosts when their explicit requirements (e.g. DJ, photographer) are unfulfilled.
 */
export function checkMustHaveConflicts(plan: EventPlan, ctx: EngineContext): Conflict[] {
  const conflicts: Conflict[] = [];
  const mustHaves = plan.constraints.filter((c) => c.kind === 'must_have');

  for (const c of mustHaves) {
    const family = familyForText(c.description);
    if (!family || plan.budgetItems.some((i) => i.rateKey?.startsWith(`${family}.`))) {
      continue;
    }
    const rate = getRate(family, 'standard') ?? getRate(family, 'essential');
    if (!rate) continue;

    const tier = tierForCity(plan.meta.city);
    const mult = getTemplate(plan.meta.type).categoryMultipliers?.[rate.category] ?? 1;
    const repriced = itemFromRate(rate, {
      guestCount: plan.meta.guestCount,
      tier,
      categoryMultiplier: mult,
    });
    const fullItem = { ...repriced, id: ctx.ids('item') };
    const addOp: PlanPatchOp = {
      type: 'add_budget_item',
      item: fullItem,
    };

    conflicts.push({
      id: `conflict_must_have_${c.id}`,
      kind: 'must_have_missing',
      severity: 'warning',
      message: `Must-have requirement "${c.description}" is not currently in the plan budget.`,
      options: [
        {
          id: `opt_add_${family}`,
          label: `Add ${rate.label} (${formatInr(itemTotal(fullItem, plan.meta.guestCount))})`,
          tradeoff: 'Fulfills must-have requirement at standard quality',
          ops: [addOp],
        },
      ],
    });
  }

  return conflicts;
}

function checkAccessibilityConflict(
  plan: EventPlan,
  ctx: EngineContext,
): Conflict | null {
  const needsAccess =
    (plan.guestNeeds?.wheelchairUsers ?? 0) > 0 ||
    plan.constraints.some((c) => c.kind === 'accessibility');
  const hasAccessTask = plan.tasks.some(
    (t) => t.category === 'accessibility' && t.status === 'done',
  );

  if (!needsAccess || hasAccessTask) return null;

  const addOp: PlanPatchOp = {
    type: 'add_task',
    task: {
      id: ctx.ids('task'),
      title:
        'Verify a step-free route from entrance to dining area and restrooms before confirming the venue',
      category: 'accessibility',
      priority: 'high',
      dueDaysBefore: 60,
      status: 'todo',
    },
  };
  return {
    id: 'conflict_access_unconfirmed',
    kind: 'access_unconfirmed',
    severity: 'warning',
    message:
      'Event has accessibility requirements, but venue step-free routes remain unconfirmed.',
    options: [
      {
        id: 'opt_add_access_task',
        label: 'Add venue accessibility audit task',
        tradeoff: 'Assigns coordinator task to verify step-free access',
        ops: [addOp],
      },
    ],
  };
}

function checkMonsoonConflict(plan: EventPlan, ctx: EngineContext): Conflict | null {
  const isOutdoor = plan.meta.setting === 'outdoor' || plan.meta.setting === 'mixed';
  if (!isOutdoor || !plan.meta.dateIso) return null;

  const month = new Date(plan.meta.dateIso).getUTCMonth() + 1;
  const isMonsoon = (MONSOON_MONTHS as readonly number[]).includes(month);
  const hasCover = plan.budgetItems.some((i) => i.rateKey?.startsWith('weather_cover.'));

  if (!isMonsoon || hasCover) return null;

  const coverRate = getRate('weather_cover', 'standard');
  const tier = tierForCity(plan.meta.city);
  const mult = getTemplate(plan.meta.type).categoryMultipliers?.['venue'] ?? 1;
  const coverItem = coverRate
    ? itemFromRate(coverRate, {
        guestCount: plan.meta.guestCount,
        tier,
        categoryMultiplier: mult,
      })
    : null;

  const options: ResolutionOption[] = [];
  if (coverItem) {
    const fullCoverItem = { ...coverItem, id: ctx.ids('item') };
    options.push({
      id: 'opt_add_weather_cover',
      label: `Add weather cover canopy (${formatInr(itemTotal(fullCoverItem, plan.meta.guestCount))})`,
      tradeoff: 'Protects guests against heavy monsoon rainfall',
      ops: [{ type: 'add_budget_item', item: fullCoverItem }],
    });
  }
  options.push({
    id: 'opt_move_indoor',
    label: 'Change setting to indoor venue',
    tradeoff: 'Avoids weather disruption by moving completely indoors',
    ops: [{ type: 'set_setting', setting: 'indoor' }],
  });

  return {
    id: 'conflict_monsoon_outdoor',
    kind: 'monsoon_outdoor',
    severity: 'warning',
    message:
      'Outdoor event is scheduled during monsoon season (June-September) without rain cover.',
    options,
  };
}

/**
 * Checks for accessibility task confirmations and monsoon rain protection.
 * WHY: Prevents high-risk operational oversights before contracts are signed.
 */
export function checkLogisticsConflicts(plan: EventPlan, ctx: EngineContext): Conflict[] {
  const conflicts: Conflict[] = [];
  const accessConflict = checkAccessibilityConflict(plan, ctx);
  if (accessConflict) conflicts.push(accessConflict);

  const monsoonConflict = checkMonsoonConflict(plan, ctx);
  if (monsoonConflict) conflicts.push(monsoonConflict);

  return conflicts;
}
