import type { Concept, EventPlan, PlanPatchOp } from '@/domain/types';
import { budgetTotal } from '@/engine/budget';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import { checkRequest, type Conflict } from '@/engine/conflicts';
import type { EngineContext } from '@/engine/context';
import { suggestSavings } from '@/engine/guardian';
import { formatInr } from '@/lib/format';
import type { CombineConceptsIntent, SelectConceptIntent } from '@/llm/schemas/intent';
import {
  combineConcepts,
  conceptFit,
  resolveConceptRef,
  selectConceptOps,
} from '../concepts';
import type { AssistantOutcome } from '../types';

function buildConceptConflictOutcome(
  plan: EventPlan,
  concept: Concept,
  ops: PlanPatchOp[],
  fit: ReturnType<typeof conceptFit>,
  conflicts: Conflict[],
  ctx: EngineContext,
): AssistantOutcome {
  const overBy = fit.overBy;
  const funding = suggestSavings(plan, overBy, {}, ctx);
  const fundingOptions: RecoveryOption[] = funding
    .map((s, idx) => {
      const mergedOps = [...ops, ...s.ops];
      return buildOption(
        plan,
        mergedOps,
        {
          id: `opt_select_${concept.id}_fund_${idx + 1}`,
          label: `Select "${concept.title}" with savings: ${s.label}`,
          tradeoff: `Applies concept style and saves ${formatInr(s.achieved)} to stay within ${formatInr(fit.cap ?? 0)}`,
          notes: concept.experienceHighlights,
        },
        ctx,
        false,
        'user',
      );
    })
    .filter((o): o is RecoveryOption => o !== undefined);

  const raiseCapOption =
    fit.cap !== null
      ? buildOption(
          plan,
          [...ops, { type: 'set_budget_cap', amount: fit.total }],
          {
            id: `opt_select_${concept.id}_raise_cap`,
            label: `Select "${concept.title}" and raise cap to ${formatInr(fit.total)}`,
            tradeoff: `Increases hard budget cap by ${formatInr(overBy)}`,
            notes: concept.experienceHighlights,
          },
          ctx,
          false,
          'user',
        )
      : undefined;

  const allOptions = raiseCapOption ? [raiseCapOption, ...fundingOptions] : fundingOptions;

  return {
    kind: 'conflict',
    message: `Selecting concept "${concept.title}" would cost ${formatInr(fit.total)}, exceeding your hard budget cap of ${formatInr(fit.cap ?? 0)} by ${formatInr(overBy)}.`,
    conflicts,
    options: allOptions,
  };
}

export function resolveSelectConcept(
  plan: EventPlan,
  intent: SelectConceptIntent,
  ctx: EngineContext,
): AssistantOutcome {
  if (plan.concepts.length === 0) {
    return {
      kind: 'clarify',
      question:
        'No concepts have been generated for this plan yet. Please request concepts before selecting one.',
    };
  }

  const res = resolveConceptRef(plan.concepts, intent.conceptRef);
  if (!res.ok) {
    return {
      kind: 'clarify',
      question: res.error.message,
    };
  }

  const concept = res.value;
  const fit = conceptFit(plan, concept, ctx);
  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const ops = selectConceptOps(plan, concept, ctx);

  const checkRes = checkRequest(plan, ops, ctx);
  if (checkRes.verdict === 'conflict') {
    return buildConceptConflictOutcome(plan, concept, ops, fit, checkRes.newConflicts, ctx);
  }

  const capText = fit.cap !== null ? ` (Cap: ${formatInr(fit.cap)})` : '';
  const opt = buildOption(
    plan,
    ops,
    {
      id: `opt_select_${concept.id}`,
      label: `Select concept "${concept.title}"`,
      tradeoff: `Applies concept style profile; estimated spend: ${formatInr(fit.total)}${capText}`,
      notes: concept.experienceHighlights,
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Proposed selecting concept "${concept.title}". Estimated spend shifts from ${formatInr(totalBefore)} to ${formatInr(fit.total)}${capText}.`,
    options: opt ? [opt] : [],
    notes: concept.tradeoffs,
  };
}

export function resolveCombineConcepts(
  plan: EventPlan,
  intent: CombineConceptsIntent,
  ctx: EngineContext,
): AssistantOutcome {
  if (plan.concepts.length === 0) {
    return {
      kind: 'clarify',
      question:
        'No concepts have been generated for this plan yet. Please request concepts before combining them.',
    };
  }

  const combinedRes = combineConcepts(plan, intent, ctx);
  if (!combinedRes.ok) {
    return {
      kind: 'clarify',
      question: combinedRes.error.message,
    };
  }

  const proposal = combinedRes.value;
  const totalBefore = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const targetNote = proposal.targetTotal
    ? ` targeting ${formatInr(proposal.targetTotal)} (${intent.percentCheaper}% savings)`
    : '';

  return {
    kind: 'proposal',
    message: `Proposed combining "${proposal.baseConcept.title}" with ${intent.borrowCategories.join(', ')} from "${proposal.borrowConcept.title}"${targetNote}. Spend moves from ${formatInr(totalBefore)} to ${formatInr(proposal.combinedTotal)}.`,
    options: proposal.options,
    notes: [],
  };
}
