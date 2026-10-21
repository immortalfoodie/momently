import { getRate } from '@/data/rateCards';
import type { QualityLevel } from '@/data/rateCards.schema';
import { getTemplate } from '@/data/templates';
import type { BudgetItem, EventPlan, PlanPatchOp, Task } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { qualityOfItem } from '@/engine/levers';
import { itemFromRate, priceRate, tierForCity } from '@/engine/pricing';
import { scoreRisks } from '@/engine/risk';
import { formatInr } from '@/lib/format';
import { buildOption } from './option';
import type { RecoveryOption, ScenarioResult } from './types';

export const BACKUP_VENUE_HOLD_PERCENT = 25;

function determineTypicalQuality(plan: EventPlan): QualityLevel {
  const counts: Record<QualityLevel, number> = { essential: 0, standard: 0, premium: 0 };
  for (const item of plan.budgetItems) {
    const q = qualityOfItem(item);
    if (q) counts[q]++;
  }
  if (counts.premium > counts.standard && counts.premium > counts.essential)
    return 'premium';
  if (counts.essential > counts.standard && counts.essential > counts.premium)
    return 'essential';
  return 'standard';
}

function makeRainTask(ctx: EngineContext): Task {
  return {
    id: ctx.ids('task'),
    title: 'Agree a rain-call decision time (24 hours before) with venue and caterer',
    category: 'venue',
    priority: 'high',
    dueDaysBefore: 1,
    status: 'todo',
  };
}

export function simulateRain(plan: EventPlan, ctx: EngineContext): ScenarioResult {
  const scoreBefore = scoreRisks(plan, ctx).score;

  if (plan.meta.setting === 'indoor') {
    return {
      input: { type: 'rain' },
      applicable: false,
      headline: 'Rain scenario is not applicable for indoor events',
      summary:
        'The event is already scheduled in an indoor venue with complete weather protection.',
      options: [],
      scoreBefore,
    };
  }

  const options: RecoveryOption[] = [];
  const tier = tierForCity(plan.meta.city);
  const template = getTemplate(plan.meta.type);
  const venueMultiplier = template.categoryMultipliers?.['venue'] ?? 1;

  // Option A: Covered layout
  const quality = determineTypicalQuality(plan);
  const coverRate =
    getRate('weather_cover', quality) ?? getRate('weather_cover', 'standard');
  if (coverRate) {
    const coverItemInput = itemFromRate(coverRate, {
      guestCount: plan.meta.guestCount,
      tier,
      categoryMultiplier: venueMultiplier,
    });
    const coverItem: BudgetItem = { ...coverItemInput, id: ctx.ids('item') };
    const taskA = makeRainTask(ctx);
    const opsA: PlanPatchOp[] = [
      { type: 'add_budget_item', item: coverItem },
      { type: 'add_task', task: taskA },
    ];
    const costA = coverItem.unitCost * coverItem.quantity;
    const optA = buildOption(
      plan,
      opsA,
      {
        id: 'opt_rain_cover',
        label: 'Covered layout: weather canopy',
        tradeoff: `Install canopy cover (${formatInr(costA)}) to maintain open-air ambiance safely`,
        notes: [
          'Canopy provides full coverage while retaining the scheduled outdoor setup.',
        ],
      },
      ctx,
    );
    if (optA) options.push(optA);
  }

  // Option B: Backup indoor hall on standby
  const essentialVenueRate = getRate('venue_hall', 'essential');
  if (essentialVenueRate) {
    const essentialCost = priceRate(essentialVenueRate, {
      guestCount: plan.meta.guestCount,
      tier,
      categoryMultiplier: venueMultiplier,
    });
    const holdCost = Math.round((essentialCost * BACKUP_VENUE_HOLD_PERCENT) / 100);
    const holdItem: BudgetItem = {
      id: ctx.ids('item'),
      category: 'venue',
      label: 'Backup indoor hall hold (25%)',
      basis: 'flat',
      unitCost: holdCost,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
      note: 'Standby backup venue hold (25% of essential hall rate)',
    };
    const taskB = makeRainTask(ctx);
    const opsB: PlanPatchOp[] = [
      { type: 'add_budget_item', item: holdItem },
      { type: 'add_task', task: taskB },
    ];
    const optB = buildOption(
      plan,
      opsB,
      {
        id: 'opt_rain_backup_hall',
        label: 'Backup indoor hall on standby',
        tradeoff: `Reserve standby indoor hall hold for ${formatInr(holdCost)} (25% deposit)`,
        notes: [
          'Venue terms must be confirmed with property management before executing hold.',
          'Hold deposit guarantees indoor relocation if severe storm hits.',
        ],
      },
      ctx,
    );
    if (optB) options.push(optB);
  }

  return {
    input: { type: 'rain' },
    applicable: options.length > 0,
    headline: 'Sudden rain threatens open-air celebration',
    summary:
      'Evaluate canopy shelter vs an indoor backup hall reservation to protect guests from sudden showers.',
    options,
    scoreBefore,
  };
}
