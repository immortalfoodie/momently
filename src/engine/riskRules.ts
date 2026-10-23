import type { EventPlan, Risk } from '@/domain/types';
import { budgetTotal, contingencyPercent, getBudgetCap } from './budget';
import { validateSchedule } from './scheduleDelay';

export const RISK_WEIGHTS = {
  weather_uncovered_outdoor: 25,
  weather_uncovered_mixed: 10,
  contingency_thin: 12,
  budget_tight: 10,
  budget_exceeded: 25,
  guest_limit_exceeded: 25,
  vendors_unbooked_per_vendor: 8,
  vendors_unbooked_max: 24,
  schedule_no_slack: 10,
  access_unconfirmed: 15,
  prices_unverified: 10,
  date_unset: 5,
} as const;

export interface EvaluatedRisk {
  ruleId: string;
  points: number;
  risk: Risk;
}

export function checkWeatherRisk(plan: EventPlan): EvaluatedRisk | null {
  if (plan.meta.setting === 'indoor') return null;
  const isOutdoor = plan.meta.setting === 'outdoor';

  const hasCover = plan.budgetItems.some((i) => i.rateKey?.startsWith('weather_cover.'));
  const hasBackupVenue = plan.budgetItems.some(
    (i) =>
      i.category === 'venue' &&
      /(backup|standby|hold)/i.test(`${i.label} ${i.note ?? ''}`),
  );

  if (hasCover || hasBackupVenue) return null;

  const points = isOutdoor
    ? RISK_WEIGHTS.weather_uncovered_outdoor
    : RISK_WEIGHTS.weather_uncovered_mixed;

  return {
    ruleId: 'weather_uncovered',
    points,
    risk: {
      id: 'risk_weather_uncovered',
      severity: isOutdoor ? 'high' : 'medium',
      title: 'Open-air venue without rain protection',
      explanation: `${isOutdoor ? 'Outdoor' : 'Mixed or undecided'} setting lacks rain canopy cover or hold on backup indoor space.`,
      mitigation: 'Add weather cover canopy or confirm a 24-hour backup venue hold.',
    },
  };
}

export function checkBudgetRisks(plan: EventPlan): EvaluatedRisk[] {
  const results: EvaluatedRisk[] = [];
  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const cap = getBudgetCap(plan.constraints);

  if (cap !== null) {
    if (total > cap) {
      results.push({
        ruleId: 'budget_exceeded',
        points: RISK_WEIGHTS.budget_exceeded,
        risk: {
          id: 'risk_budget_exceeded',
          severity: 'high',
          title: 'Budget cap exceeded',
          explanation: `Total expenditure of ₹${total.toLocaleString('en-IN')} exceeds the hard limit of ₹${cap.toLocaleString('en-IN')}.`,
          mitigation: 'Apply budget savings levers or raise the budget cap.',
        },
      });
    } else if (total / cap >= 0.95) {
      results.push({
        ruleId: 'budget_tight',
        points: RISK_WEIGHTS.budget_tight,
        risk: {
          id: 'risk_budget_tight',
          severity: 'medium',
          title: 'Budget margin is razor-thin',
          explanation: `Current expenditure consumes ${((total / cap) * 100).toFixed(1)}% of the hard cap.`,
          mitigation: 'Maintain a reserve cushion for unexpected on-day charges.',
        },
      });
    }
  }

  const recPct = contingencyPercent(plan.meta.type, plan.meta.setting);
  const subtotal = budgetTotal(
    plan.budgetItems.filter((i) => i.category !== 'contingency'),
    plan.meta.guestCount,
  );
  const recContingency = Math.round((subtotal * recPct) / 100);
  const actualContingency = budgetTotal(
    plan.budgetItems.filter((i) => i.category === 'contingency'),
    plan.meta.guestCount,
  );

  if (actualContingency < recContingency) {
    results.push({
      ruleId: 'contingency_thin',
      points: RISK_WEIGHTS.contingency_thin,
      risk: {
        id: 'risk_contingency_thin',
        severity: 'medium',
        title: 'Contingency reserve below recommendation',
        explanation: `Contingency reserve is ₹${actualContingency.toLocaleString('en-IN')} vs recommended ${recPct}% (₹${recContingency.toLocaleString('en-IN')}).`,
        mitigation:
          'Restore recommended contingency reserve to absorb unexpected price increases.',
      },
    });
  }

  return results;
}

export function checkCapacityAndSchedule(plan: EventPlan): EvaluatedRisk[] {
  const results: EvaluatedRisk[] = [];

  const maxGuestConstraint = plan.constraints.find(
    (c) =>
      c.kind === 'guest_count' &&
      c.severity === 'hard' &&
      typeof c.numericValue === 'number' &&
      plan.meta.guestCount > c.numericValue,
  );
  if (maxGuestConstraint) {
    results.push({
      ruleId: 'guest_limit_exceeded',
      points: RISK_WEIGHTS.guest_limit_exceeded,
      risk: {
        id: 'risk_guest_limit_exceeded',
        severity: 'high',
        title: 'Guest attendance exceeds venue capacity',
        explanation: `Guest count (${plan.meta.guestCount}) exceeds venue capacity constraint of ${maxGuestConstraint.numericValue}.`,
        mitigation: 'Trim attendee count or relocate to a higher-capacity venue hall.',
      },
    });
  }

  const { totalSlackMinutes } = validateSchedule(plan.schedule);
  if (totalSlackMinutes < 30) {
    results.push({
      ruleId: 'schedule_no_slack',
      points: RISK_WEIGHTS.schedule_no_slack,
      risk: {
        id: 'risk_schedule_no_slack',
        severity: 'medium',
        title: 'Tight schedule with insufficient buffer',
        explanation: `Schedule has only ${totalSlackMinutes} minutes of total slack; any minor delay will trigger late-night overruns.`,
        mitigation: 'Add 15-30 minute buffer gaps between key event milestones.',
      },
    });
  }

  return results;
}

export { checkVendorAndPricingRisks } from './riskPricingRules';
