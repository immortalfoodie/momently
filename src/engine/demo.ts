import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventMeta, EventPlan } from '@/domain/types';
import { attachConcepts } from './assistant/concepts';
import type { EngineContext } from './context';
import type { FitReport } from './planFactory';
import { createPlan } from './planFactory';

export interface DemoPlanResult {
  plan: EventPlan;
  fit: FitReport;
  assumptions: string[];
}

/**
 * Deterministically constructs the benchmark 25th anniversary demo event plan.
 * WHY: Provides instant, zero-network initialization of the rich demo workspace with pre-populated
 * line items, tasks, schedule milestones, and attached concepts for onboarding and evaluation.
 *
 * @param ctx - Engine context providing pure ID generation and system clock.
 * @returns Object with the constructed EventPlan, budget FitReport, and empty assumptions array.
 */
export function buildDemoPlan(ctx: EngineContext): DemoPlanResult {
  const meta: EventMeta = {
    ...DEMO_SCENARIO.meta,
    dateIso: '2026-12-15',
    hostBrief: DEMO_SCENARIO.hostBrief,
  };

  const created = createPlan({
    meta,
    constraints: [...DEMO_SCENARIO.constraints],
    ids: ctx.ids,
    clock: ctx.clock,
  });

  const conceptsProposal = DEMO_SCENARIO.concepts.map((c) => ({
    title: c.title,
    tagline: c.tagline,
    summary: c.summary,
    palette: c.palette,
    experienceHighlights: c.experienceHighlights,
    qualityProfile: c.qualityProfile ?? {},
    tradeoffs: c.tradeoffs,
    whyItFits: c.whyItFits,
    tags: c.tags,
  }));

  const planWithConcepts = attachConcepts(
    created.plan,
    { concepts: conceptsProposal },
    ctx,
  );

  return {
    plan: planWithConcepts,
    fit: created.fit,
    assumptions: [],
  };
}
