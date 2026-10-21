import type { BudgetCategory, EventPlan } from '@/domain/types';

export interface ForgottenCost {
  id: string;
  category: BudgetCategory;
  title: string;
  why: string;
}

interface ForgottenCostRule {
  id: string;
  category: BudgetCategory;
  title: string;
  why: string;
  predicate: (plan: EventPlan) => boolean;
}

const FORGOTTEN_COST_RULES: readonly ForgottenCostRule[] = [
  {
    id: 'fc_weather_cover',
    category: 'venue',
    title: 'Weather cover / backup venue',
    why: 'Outdoor or mixed settings require rain or sun protection to prevent disruption.',
    predicate: (plan) =>
      (plan.meta.setting === 'outdoor' || plan.meta.setting === 'mixed') &&
      !plan.budgetItems.some((i) => i.rateKey?.startsWith('weather_cover.')),
  },
  {
    id: 'fc_venue_terms',
    category: 'venue',
    title: 'Venue security deposit & overtime terms',
    why: 'Venues typically require refundable damage deposits and charge strict hourly overtime fees.',
    predicate: (plan) => plan.budgetItems.some((i) => i.category === 'venue'),
  },
  {
    id: 'fc_food_taxes',
    category: 'food',
    title: 'Catering taxes & service staff charges',
    why: 'F&B quotes often omit 5-18% statutory GST and service staff gratuities.',
    predicate: (plan) => plan.budgetItems.some((i) => i.category === 'food'),
  },
  {
    id: 'fc_music_licensing',
    category: 'entertainment',
    title: 'Music performance licensing (PPL / IPRS)',
    why: 'Commercial DJ and live music performances in commercial venues require statutory licenses.',
    predicate: (plan) => plan.budgetItems.some((i) => i.category === 'entertainment'),
  },
  {
    id: 'fc_photography_overtime',
    category: 'photography',
    title: 'Photography overtime & album deliveries',
    why: 'Events that run late incur hourly crew charges, and physical photobooks cost extra.',
    predicate: (plan) => plan.budgetItems.some((i) => i.category === 'photography'),
  },
  {
    id: 'fc_decor_labour',
    category: 'decor',
    title: 'Decor installation & teardown labour',
    why: 'Complex floral and lighting themes require dedicated setup and strike crews.',
    predicate: (plan) => plan.budgetItems.some((i) => i.category === 'decor'),
  },
  {
    id: 'fc_parking_transport',
    category: 'transport',
    title: 'Guest valet parking & transit assistance',
    why: 'Large guest lists or senior attendees need reserved parking or golf cart shuttles.',
    predicate: (plan) =>
      plan.meta.guestCount >= 100 || (plan.guestNeeds?.elderly ?? 0) > 0,
  },
  {
    id: 'fc_kids_activities',
    category: 'other',
    title: "Children's snacks & activity zone",
    why: 'Attending children need kid-friendly snacks and engagement to keep celebrations smooth.',
    predicate: (plan) => (plan.guestNeeds?.children ?? 0) > 0,
  },
  {
    id: 'fc_wheelchair_route',
    category: 'venue',
    title: 'Accessible ramps & assistance personnel',
    why: 'Wheelchair attendees require verified step-free transit and dedicated helpers.',
    predicate: (plan) => (plan.guestNeeds?.wheelchairUsers ?? 0) > 0,
  },
  {
    id: 'fc_staff_tips',
    category: 'other',
    title: 'Discretionary tips for venue and transport staff',
    why: 'Tips for banquet servers, drivers, security, and setup crews are customary.',
    predicate: () => true,
  },
];

/**
 * Identifies unpriced operational reminders and gotchas based on event parameters and plan composition.
 * WHY: Helps hosts anticipate hidden venue deposits, license fees, taxes, and tips without inventing numbers.
 *
 * @param plan - Target EventPlan.
 * @returns Array of ForgottenCost reminders in deterministic order.
 */
export function findForgottenCosts(plan: EventPlan): ForgottenCost[] {
  return FORGOTTEN_COST_RULES.filter((rule) => rule.predicate(plan)).map((rule) => ({
    id: rule.id,
    category: rule.category,
    title: rule.title,
    why: rule.why,
  }));
}
