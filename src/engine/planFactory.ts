import { getRate } from '@/data/rateCards';
import type { QualityLevel } from '@/data/rateCards.schema';
import { getTemplate } from '@/data/templates';
import type { CityTier } from '@/domain/constants';
import type {
  BudgetItem,
  Constraint,
  DecisionRecord,
  EventMeta,
  EventPlan,
  GuestNeeds,
  Money,
} from '@/domain/types';
import { formatInr } from '@/lib/format';
import {
  budgetTotal,
  contingencyPercent,
  getBudgetCap,
  refreshContingency,
} from './budget';
import type { DowngradeRecord } from './downgrade';
import { optimizeBudgetToCap } from './downgrade';
import { itemFromRate, tierForCity } from './pricing';

export type { DowngradeRecord } from './downgrade';

export interface FitReport {
  fits: boolean;
  total: Money;
  cap: Money | null;
  downgrades: DowngradeRecord[];
  message: string;
}

export interface CreatePlanInput {
  meta: EventMeta;
  constraints: Constraint[];
  guestNeeds?: GuestNeeds;
  quality?: QualityLevel;
  ids: (prefix?: string) => string;
  clock: () => Date;
}

const DEFAULT_GUEST_NEEDS: GuestNeeds = {
  vegetarian: 0,
  jain: 0,
  vegan: 0,
  glutenFree: 0,
  allergyAlerts: 0,
  wheelchairUsers: 0,
  elderly: 0,
  children: 0,
  quietSpaceNeeded: false,
  languages: [],
};

function buildTemplateBudgetItem(
  family: string,
  quality: QualityLevel,
  meta: EventMeta,
  tier: CityTier,
  mult: number,
  ids: (prefix?: string) => string,
): BudgetItem {
  const rate = getRate(family, quality);
  if (!rate) {
    return {
      id: ids('item'),
      category: 'other',
      label: family,
      basis: 'flat',
      unitCost: 0,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
      rateKey: `${family}.${quality}`,
    };
  }

  const base = itemFromRate(rate, {
    guestCount: meta.guestCount,
    tier,
    categoryMultiplier: mult,
  });

  return {
    ...base,
    id: ids('item'),
  };
}

/**
 * Deterministically constructs an EventPlan from domain meta, constraints, and empirical templates.
 * WHY: Assembles the foundational plan, computes initial budget, and fits it within host budget caps.
 *
 * @param input - Plan initialization parameters including meta, constraints, id generator, and clock.
 * @returns An object containing the generated EventPlan and its budget fit report.
 */
export function createPlan(input: CreatePlanInput): { plan: EventPlan; fit: FitReport } {
  const { meta, constraints, ids, clock } = input;
  const template = getTemplate(meta.type);
  const tier = tierForCity(meta.city);
  const quality = input.quality ?? 'standard';
  const contingencyPct = contingencyPercent(meta.type, meta.setting);

  const rawItems = template.lineItems.map((li) => {
    const mult =
      template.categoryMultipliers?.[getRate(li.family, quality)?.category ?? 'other'] ??
      1;
    return buildTemplateBudgetItem(li.family, quality, meta, tier, mult, ids);
  });

  const cap = getBudgetCap(constraints);
  let items = refreshContingency(rawItems, meta.guestCount, contingencyPct);
  let downgrades: DowngradeRecord[] = [];
  let fits = true;
  let message = 'Plan created successfully.';

  if (cap !== null && budgetTotal(items, meta.guestCount) > cap) {
    const required = new Set(
      template.lineItems.filter((li) => li.required).map((li) => li.family),
    );
    const opt = optimizeBudgetToCap(
      rawItems,
      template.downgradeOrder,
      required,
      quality,
      {
        guestCount: meta.guestCount,
        tier,
        categoryMultipliers: template.categoryMultipliers,
        contingencyPct,
        cap,
      },
    );
    items = opt.items;
    downgrades = opt.downgrades;
    fits = opt.fits;
    const total = budgetTotal(items, meta.guestCount);
    message = fits
      ? `Adjusted ${downgrades.length} item(s) to fit within ${formatInr(cap)}.`
      : `Unable to fit all essential items within the budget cap of ${formatInr(cap)}. Minimum required budget is ${formatInr(total)}.`;
  }

  const startMinute = meta.startMinute ?? template.defaultStartMinute;
  const ledger: DecisionRecord[] = [
    {
      id: ids('dec'),
      timestamp: clock().toISOString(),
      summary: 'Plan created',
      source: 'system',
      status: 'approved',
    },
  ];

  const plan: EventPlan = {
    id: ids('plan'),
    version: 1,
    createdAt: clock().toISOString(),
    updatedAt: clock().toISOString(),
    meta,
    constraints,
    concepts: [],
    selectedConceptId: null,
    budgetItems: items,
    schedule: template.schedule.map((s) => ({
      ...s,
      id: ids('slot'),
      startMinute: startMinute + s.offsetMinutes,
    })),
    tasks: template.tasks.map((t) => ({ ...t, id: ids('task'), status: 'todo' })),
    vendors: template.vendors.map((v) => ({
      ...v,
      id: ids('vendor'),
      quotes: [],
      status: 'not_started',
    })),
    guestNeeds: input.guestNeeds ?? DEFAULT_GUEST_NEEDS,
    ledger,
  };

  const total = budgetTotal(items, meta.guestCount);
  return { plan, fit: { fits, total, cap, downgrades, message } };
}
