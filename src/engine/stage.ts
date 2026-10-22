import type { EventPlan } from '@/domain/types';

export type EventStage = 'draft' | 'planning' | 'completed';

/**
 * Derives the operational lifecycle stage of an event plan.
 * WHY: Event stage is purely derived from plan state and reference date, never stored directly.
 * - 'completed': dateIso exists and is strictly before today
 * - 'draft': no creative concept selected yet
 * - 'planning': concept selected and celebration is upcoming or undated
 *
 * @param plan - The EventPlan to inspect.
 * @param today - Current reference calendar date in YYYY-MM-DD ISO format.
 * @returns 'draft' | 'planning' | 'completed'
 */
export function eventStage(plan: EventPlan, today: string): EventStage {
  if (plan.meta.dateIso && plan.meta.dateIso < today) {
    return 'completed';
  }
  if (!plan.selectedConceptId) {
    return 'draft';
  }
  return 'planning';
}
