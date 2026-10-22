import type { Concept, DecisionRecord, EventPlan } from '@/domain/types';
import type { EngineContext } from './context';

/**
 * Replaces the array of concept suggestions on an active EventPlan.
 *
 * ARCHITECTURAL DECISION (WHY):
 * Creative celebration concepts represent advisory creative proposals, NOT binding financial decisions.
 * Modifying or re-generating the available concept pool does not mutate budget line items, tasks,
 * or contracts. Therefore, refreshing concepts is modeled as a direct plan state update with an audit
 * ledger record rather than an engine PlanPatchOp.
 *
 * If the previously selected concept ID is not present in the new candidate set, selectedConceptId
 * is cleared back to null, while existing budget selections remain unchanged until a new concept is chosen.
 *
 * @param plan - The active EventPlan.
 * @param concepts - Fresh array of candidate Concept suggestions.
 * @param ctx - Engine context providing ID generation and system clock.
 * @returns A new EventPlan with replaced concepts, updated version, and a decision audit entry.
 */
export function replaceConcepts(
  plan: EventPlan,
  concepts: Concept[],
  ctx: EngineContext,
): EventPlan {
  const selectedStillExists =
    plan.selectedConceptId !== null &&
    concepts.some((c) => c.id === plan.selectedConceptId);

  const selectedConceptId = selectedStillExists ? plan.selectedConceptId : null;

  const ledgerEntry: DecisionRecord = {
    id: ctx.ids('dec'),
    timestamp: ctx.clock().toISOString(),
    summary: 'Refreshed concept ideas',
    source: 'user',
    status: 'approved',
  };

  const nextLedger = [...plan.ledger, ledgerEntry];
  const trimmedLedger =
    nextLedger.length > 500 ? nextLedger.slice(nextLedger.length - 500) : nextLedger;

  return {
    ...plan,
    concepts: [...concepts],
    selectedConceptId,
    version: plan.version + 1,
    updatedAt: ctx.clock().toISOString(),
    ledger: trimmedLedger,
  };
}
