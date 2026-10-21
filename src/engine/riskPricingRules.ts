import type { EventPlan } from '@/domain/types';
import { budgetTotal } from './budget';
import { isAccessUnconfirmed } from './conflictRules';
import type { EngineContext } from './context';
import type { EvaluatedRisk } from './riskRules';
import { RISK_WEIGHTS } from './riskRules';

function checkVendorLeadTimes(plan: EventPlan, ctx: EngineContext): EvaluatedRisk | null {
  if (!plan.meta.dateIso) {
    return {
      ruleId: 'date_unset',
      points: RISK_WEIGHTS.date_unset,
      risk: {
        id: 'risk_date_unset',
        severity: 'low',
        title: 'Event date undecided',
        explanation:
          'Event date is not set, preventing booking lead-time verification and seasonal risk checks.',
        mitigation: 'Lock in target calendar date to establish vendor deadlines.',
      },
    };
  }

  const eventTime = new Date(plan.meta.dateIso).getTime();
  const currentTime = ctx.clock().getTime();
  const daysAway = Math.floor((eventTime - currentTime) / (1000 * 60 * 60 * 24));

  if (daysAway <= 30) {
    const unbooked = plan.vendors.filter((v) => v.status !== 'booked').length;
    if (unbooked > 0) {
      const points = Math.min(
        RISK_WEIGHTS.vendors_unbooked_max,
        unbooked * RISK_WEIGHTS.vendors_unbooked_per_vendor,
      );
      return {
        ruleId: 'vendors_unbooked',
        points,
        risk: {
          id: 'risk_vendors_unbooked',
          severity: 'high',
          title: 'Critical vendors unbooked close to event date',
          explanation: `${unbooked} vendor requirements remain unbooked with only ${daysAway} days remaining.`,
          mitigation:
            'Shortlist and contract outstanding vendors immediately to avoid peak surge pricing.',
        },
      };
    }
  }

  return null;
}

export function checkVendorAndPricingRisks(
  plan: EventPlan,
  ctx: EngineContext,
): EvaluatedRisk[] {
  const results: EvaluatedRisk[] = [];

  const leadTimeRisk = checkVendorLeadTimes(plan, ctx);
  if (leadTimeRisk) results.push(leadTimeRisk);

  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const estimateTotal = budgetTotal(
    plan.budgetItems.filter((i) => i.provenance === 'estimate'),
    plan.meta.guestCount,
  );
  if (total > 0 && estimateTotal / total > 0.7) {
    results.push({
      ruleId: 'prices_unverified',
      points: RISK_WEIGHTS.prices_unverified,
      risk: {
        id: 'risk_prices_unverified',
        severity: 'medium',
        title: 'High proportion of unverified price estimates',
        explanation: `${Math.round((estimateTotal / total) * 100)}% of the budget is based on rough rate card estimates rather than quotes.`,
        mitigation:
          'Collect vendor quotes to convert estimates into verified commitments.',
      },
    });
  }

  if (isAccessUnconfirmed(plan)) {
    results.push({
      ruleId: 'access_unconfirmed',
      points: RISK_WEIGHTS.access_unconfirmed,
      risk: {
        id: 'risk_access_unconfirmed',
        severity: 'medium',
        title: 'Accessibility arrangements unconfirmed',
        explanation:
          'Event includes guests with mobility needs, but step-free access routes have not been verified.',
        mitigation:
          'Conduct venue walkthrough to verify ramps, elevators, and step-free restrooms.',
      },
    });
  }

  return results;
}
