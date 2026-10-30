import { CHAOS_SCENARIO_CATALOG } from '@/domain/chaosSchemas';
import type { IntentKind, IntentOutput } from '@/llm/schemas/intent';
import { formatInr } from '@/lib/format';

type LabelFor<K extends IntentKind> = (intent: Extract<IntentOutput, { kind: K }>) => string;

function humanize(code: string): string {
  return code.replace(/_/g, ' ');
}

const LABELS: { [K in IntentKind]: LabelFor<K> } = {
  change_guest_count: (i) => `Change the guest count to ${i.guestCount}`,
  change_budget: (i) => `Set the budget to ${formatInr(i.amount)}${i.hard ? ' (hard cap)' : ''}`,
  adjust_category: (i) => `${i.percent >= 0 ? 'Increase' : 'Reduce'} ${i.category} by ${Math.abs(i.percent)}%`,
  upgrade: (i) => `Upgrade ${humanize(i.family)} to ${i.toQuality}`,
  downgrade: (i) => `Step ${humanize(i.family)} down to ${i.toQuality}`,
  save_money: (i) => `Find savings of ${formatInr(i.amount)}`,
  afford_check: (i) => `Check whether we can afford ${i.description}`,
  find_forgotten: () => 'Look for costs we may have forgotten',
  make_it_premium: () => 'Make it look more premium',
  simulate: (i) =>
    `Test: ${CHAOS_SCENARIO_CATALOG.find((c) => c.type === i.scenario.type)?.label ?? i.scenario.type}`,
  select_concept: (i) => `Choose concept ${i.conceptRef}`,
  combine_concepts: (i) => `Combine concept ${i.baseRef} with ideas from concept ${i.borrowRef}`,
  add_preference: (i) => `Remember: ${i.description}`,
  set_setting: (i) => `Set the venue setting to ${i.setting}`,
  set_date: (i) => `Set the event date to ${i.dateIso}`,
  answer: () => 'Answer your question',
  clarify: () => 'Ask a clarifying question',
  decline: () => 'Decline an out-of-scope request',
};

/**
 * Plain-English label for an intent, used in the "What I'll do" step list.
 *
 * @param intent - Validated intent.
 * @returns Short host-facing description of the step.
 */
export function describeIntent(intent: IntentOutput): string {
  return (LABELS[intent.kind] as (i: IntentOutput) => string)(intent);
}

/** Intent kinds that set a single value, so two different values in one message clash. */
const SINGLE_VALUE_KINDS = new Set<IntentKind>([
  'change_guest_count',
  'change_budget',
  'select_concept',
  'set_setting',
  'set_date',
]);

function familyOf(intent: IntentOutput): string | null {
  return intent.kind === 'upgrade' || intent.kind === 'downgrade' ? intent.family : null;
}

function stepsClash(a: IntentOutput, b: IntentOutput): boolean {
  const sameSingle = a.kind === b.kind && SINGLE_VALUE_KINDS.has(a.kind) && JSON.stringify(a) !== JSON.stringify(b);
  const family = familyOf(a);
  const opposingFamily = family !== null && family === familyOf(b) && a.kind !== b.kind;
  return sameSingle || opposingFamily;
}

/**
 * Finds two steps in one message that contradict each other.
 * WHY: "Make it 100 guests and make it 120 guests" must be clarified, not silently resolved
 * by whichever step happens to run last.
 *
 * @param steps - Ordered intents from one message.
 * @returns A clarifying question naming both steps, or null when the steps are compatible.
 */
export function findStepClash(steps: readonly IntentOutput[]): string | null {
  for (const [i, a] of steps.entries()) {
    const b = steps.slice(i + 1).find((other) => stepsClash(a, other));
    if (b) {
      return `You asked me to "${describeIntent(a)}" and also to "${describeIntent(b)}". Which one should I go with?`;
    }
  }
  return null;
}
