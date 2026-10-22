import { getRate, listFamilies } from '@/data/rateCards';
import type { QualityLevel } from '@/domain/baseSchemas';
import type { BudgetCategory, BudgetItem, Concept, EventPlan, Money, PlanPatchOp } from '@/domain/types';
import { getBudgetCap } from '@/engine/budget';
import type { EngineContext } from '@/engine/context';
import { previewOps } from '@/engine/preview';
import { setItemQuality } from '@/engine/qualityOps';
import { err, ok, type Result } from '@/lib/result';
import type { ConceptProposal, ConceptsOutput } from '@/llm/schemas/concepts';
import type { AssistantError } from './types';

export { combineConcepts, type CombineProposal } from './combineConcepts';

export function categoryForFamily(family: string): BudgetCategory | undefined {
  const normalized = family === 'decor' ? 'decor_theme' : family;
  return (
    getRate(normalized, 'standard')?.category ??
    getRate(normalized, 'essential')?.category ??
    getRate(normalized, 'premium')?.category
  );
}

function opForItem(
  item: BudgetItem,
  profile: Record<string, QualityLevel>,
  plan: EventPlan,
): PlanPatchOp | undefined {
  if (item.locked || item.provenance !== 'estimate' || !item.rateKey) return undefined;
  const family = item.rateKey.split('.')[0];
  if (!family) return undefined;

  const targetQ = profile[family] ?? (family === 'decor_theme' ? profile.decor : undefined);
  if (!targetQ) return undefined;

  const stepped = setItemQuality(plan, item, targetQ);
  if (!stepped) return undefined;

  return {
    type: 'update_budget_item',
    id: item.id,
    changes: stepped.changes,
  };
}

/**
 * Derives the patch operations to apply a concept's quality profile to an EventPlan.
 * WHY: Only touches unlocked estimate items matching profile families; ignores unplannable families.
 */
export function selectConceptOps(
  plan: EventPlan,
  concept: Concept | ConceptProposal | { id?: string; qualityProfile?: Record<string, QualityLevel> },
  ctx?: EngineContext,
): PlanPatchOp[] {
  void ctx;
  const ops: PlanPatchOp[] = [];
  if ('id' in concept && concept.id && plan.concepts.some((c) => c.id === concept.id)) {
    ops.push({ type: 'select_concept', conceptId: concept.id });
  }

  const profile = concept.qualityProfile ?? {};
  for (const item of plan.budgetItems) {
    const op = opForItem(item, profile, plan);
    if (op) ops.push(op);
  }

  return ops;
}

/**
 * Previews the true monetary cost of a concept against an active plan, including dynamic contingency.
 */
export function priceConcept(
  plan: EventPlan,
  concept: Concept | ConceptProposal | { id?: string; qualityProfile?: Record<string, QualityLevel> },
  ctx: EngineContext,
): Money {
  const ops = selectConceptOps(plan, concept);
  const preview = previewOps(plan, ops, ctx);
  return preview.ok ? preview.value.impact.budgetTotalAfter : 0;
}

/**
 * Evaluates whether a concept fits within the plan's budget cap.
 */
export function conceptFit(
  plan: EventPlan,
  concept: Concept,
  ctx: EngineContext,
): { total: Money; cap: Money | null; overBy: Money; fits: boolean } {
  const total =
    concept.estimatedTotal && concept.estimatedTotal > 0
      ? concept.estimatedTotal
      : priceConcept(plan, concept, ctx);
  const cap = getBudgetCap(plan.constraints);
  const overBy = cap !== null ? Math.max(0, total - cap) : 0;
  const fits = cap === null || total <= cap;
  return { total, cap, overBy, fits };
}

/**
 * Attaches generated concepts to the plan with generated IDs and precomputed totals.
 * Never auto-selects a concept.
 */
export function attachConcepts(
  plan: EventPlan,
  output: ConceptsOutput,
  ctx: EngineContext,
): EventPlan {
  const knownFamilies = new Set(listFamilies());

  const concepts: Concept[] = output.concepts.map((proposal) => {
    const cleanedProfile: Record<string, QualityLevel> = {};
    const dropped: string[] = [];

    for (const [fam, q] of Object.entries(proposal.qualityProfile)) {
      const normalized = fam === 'decor' ? 'decor_theme' : fam;
      if (knownFamilies.has(normalized)) {
        cleanedProfile[normalized] = q;
      } else {
        dropped.push(fam);
      }
    }

    const id = ctx.ids('concept');
    const conceptWithoutTotal = {
      ...proposal,
      id,
      qualityProfile: cleanedProfile,
      tradeoffs:
        dropped.length > 0
          ? [...proposal.tradeoffs, `Omitted unsupported services: ${dropped.join(', ')}`]
          : proposal.tradeoffs,
    };

    const estimatedTotal = priceConcept(plan, conceptWithoutTotal, ctx);

    return {
      ...conceptWithoutTotal,
      estimatedTotal,
    };
  });

  return {
    ...plan,
    concepts,
    selectedConceptId: null,
  };
}

/**
 * Resolves a concept reference from ordinal ('1'..'3'), case-insensitive title, or substring.
 */
export function resolveConceptRef(
  concepts: readonly Concept[],
  ref: string,
): Result<Concept, AssistantError> {
  const trimmed = ref.trim();
  const lower = trimmed.toLowerCase();

  const digitMatch = /(?:option|concept)?\s*#?([1-9]\d*)/i.exec(trimmed);
  if (digitMatch?.[1]) {
    const idx = parseInt(digitMatch[1], 10) - 1;
    const c = concepts[idx];
    if (c) return ok(c);
  }

  const ordinals: Record<string, number> = { first: 0, second: 1, third: 2 };
  const ordIdx = ordinals[lower];
  if (ordIdx !== undefined) {
    const c = concepts[ordIdx];
    if (c) return ok(c);
  }

  const exact = concepts.find((c) => c.title.toLowerCase() === lower);
  if (exact) return ok(exact);

  const sub = concepts.find((c) => c.title.toLowerCase().includes(lower));
  if (sub) return ok(sub);

  const titles = concepts.map((c) => `"${c.title}"`).join(', ');
  return err({
    message: `Concept "${ref}" not found. Available concepts: ${titles || 'none'}.`,
  });
}
