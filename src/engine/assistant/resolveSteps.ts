import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { EngineContext } from '@/engine/context';
import { previewOps } from '@/engine/preview';
import type { IntentOutput } from '@/llm/schemas/intent';
import { resolveIntent } from './resolveIntent';
import { describeIntent, findStepClash } from './stepLabels';
import type { AssistantOutcome, AssistantStepSummary } from './types';

/** Maximum operations in one patch, mirrored from the patch schema. */
const MAX_COMBINED_OPS = 30;

interface FoldedStep {
  summary: Omit<AssistantStepSummary, 'label'>;
  ops?: PlanPatchOp[];
  draft?: EventPlan;
}

function pickOption(options: RecoveryOption[], recommendedId?: string): RecoveryOption | undefined {
  return options.find((o) => o.id === recommendedId) ?? options.find((o) => o.meetsCap) ?? options[0];
}

function foldProposal(
  draft: EventPlan,
  option: RecoveryOption | undefined,
  opsSoFar: number,
  ctx: EngineContext,
): FoldedStep {
  if (!option) return { summary: { status: 'skipped', detail: 'There was nothing to change for this step.' } };
  if (opsSoFar + option.patch.ops.length > MAX_COMBINED_OPS) {
    return { summary: { status: 'skipped', detail: 'That is too many changes at once. Ask for this one separately.' } };
  }
  const preview = previewOps(draft, option.patch.ops, ctx);
  if (!preview.ok) {
    return { summary: { status: 'skipped', detail: `This step could not be applied: ${preview.error.message}` } };
  }
  return { summary: { status: 'planned', detail: option.label }, ops: option.patch.ops, draft: preview.value.plan };
}

function foldOutcome(draft: EventPlan, outcome: AssistantOutcome, opsSoFar: number, ctx: EngineContext): FoldedStep {
  switch (outcome.kind) {
    case 'proposal':
      return foldProposal(draft, pickOption(outcome.options, outcome.recommendedOptionId), opsSoFar, ctx);
    case 'chaos': {
      const { result } = outcome;
      const best = result.options.find((o) => o.id === result.recommendedOptionId);
      const advice = best ? ` Best response: ${best.label}${scoreChange(best)}.` : '';
      return {
        summary: {
          status: result.applicable ? 'checked' : 'skipped',
          detail: `${result.headline}. ${result.summary}${advice}`,
        },
      };
    }
    case 'info':
      return { summary: { status: 'checked', detail: [outcome.message, ...outcome.items.slice(0, 3).map((i) => i.title)].join(' ') } };
    case 'reply':
      return { summary: { status: 'checked', detail: outcome.text } };
    case 'clarify':
      return { summary: { status: 'skipped', detail: outcome.question } };
    case 'conflict':
    case 'error':
      return { summary: { status: 'skipped', detail: outcome.message } };
  }
}

function scoreChange(option: RecoveryOption): string {
  return option.scoreAfter === option.scoreBefore
    ? ''
    : ` (Chaos Score ${option.scoreBefore} to ${option.scoreAfter})`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function summariseMessage(steps: AssistantStepSummary[]): string {
  const planned = steps.filter((s) => s.status === 'planned').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  const skippedNote = skipped > 0 ? ` ${plural(skipped, 'step')} could not be done; see why below.` : '';
  return `I worked through your ${steps.length} requests in order and combined ${plural(planned, 'change')} into one proposal.${skippedNote}`;
}

/**
 * Resolves one to three intents from a single message into one combined, approvable outcome.
 * WHY: Each step is resolved against the plan as it would look after the previous steps (a pure
 * draft, never the stored plan), so "upgrade decor and what if it rains" tests rain against the
 * upgraded plan. All planned changes merge into ONE proposal that still needs host approval, and
 * hard budget caps are re-checked on the combined result by buildOption.
 *
 * @param plan - Current stored plan (never mutated).
 * @param steps - Ordered intents from the language model.
 * @param ctx - Engine context.
 * @param today - Reference date (YYYY-MM-DD).
 * @returns A combined proposal, an info summary, or a clarifying question when steps clash.
 */
export function resolveSteps(
  plan: EventPlan,
  steps: readonly IntentOutput[],
  ctx: EngineContext,
  today: string,
): AssistantOutcome {
  const [only] = steps;
  if (steps.length === 1 && only) return resolveIntent(plan, only, ctx, today);

  const clash = findStepClash(steps);
  if (clash) return { kind: 'clarify', question: clash };

  let draft = plan;
  const ops: PlanPatchOp[] = [];
  const summaries: AssistantStepSummary[] = [];

  for (const step of steps) {
    const folded = foldOutcome(draft, resolveIntent(draft, step, ctx, today), ops.length, ctx);
    summaries.push({ label: describeIntent(step), ...folded.summary });
    if (folded.ops && folded.draft) {
      ops.push(...folded.ops);
      draft = folded.draft;
    }
  }

  const message = summariseMessage(summaries);
  if (ops.length === 0) {
    return { kind: 'info', message, items: summaries.map((s) => ({ title: s.label, detail: s.detail })), steps: summaries };
  }

  const plannedCount = summaries.filter((s) => s.status === 'planned').length;
  const option = buildOption(
    plan,
    ops,
    {
      id: 'opt_multi_step',
      label: `Combined plan: ${plural(plannedCount, 'change')}`,
      tradeoff: 'All planned steps applied together, in the order you asked.',
      notes: summaries.filter((s) => s.status === 'planned').map((s) => `${s.label}: ${s.detail}`),
    },
    ctx,
    false,
    'ai',
  );
  if (!option) {
    return { kind: 'error', message: "I couldn't combine those changes. Try asking for them one at a time." };
  }

  return { kind: 'proposal', message, options: [option], recommendedOptionId: option.id, notes: [], steps: summaries };
}
