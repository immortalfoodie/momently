import type { EventPlan } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import { formatInr } from '@/lib/format';
import type { EventDerivedMetrics } from '@/store/selectors';

function extractChaosText(
  headline: string,
  narration?: { text: string } | string,
): string {
  if (typeof narration === 'string' && narration.trim().length > 0) {
    return narration.trim();
  }
  if (narration && typeof narration === 'object' && narration.text.trim().length > 0) {
    return narration.text.trim();
  }
  return headline;
}

function extractInfoText(message: string, items?: readonly unknown[]): string {
  if (items && items.length > 0) {
    return `Here are ${items.length} things you may be forgetting.`;
  }
  return message.split('\n')[0] ?? message;
}

/**
 * Converts any AssistantOutcome into a plain-text preview summary suitable for chat message history.
 * WHY: Chat log and notification previews require compact, readable text summaries rather than
 * large interactive cards. The full rich outcome cards are rendered via AssistantOutcomeView.
 *
 * @param outcome - Pure engine outcome discriminated union.
 * @param narration - Optional narration object or string generated for crisis/chaos simulations.
 * @returns Plain-text summary string, never exceeding 600 characters.
 */
export function outcomeToText(
  outcome: AssistantOutcome,
  narration?: { text: string } | string,
): string {
  switch (outcome.kind) {
    case 'proposal':
    case 'conflict':
    case 'error':
      return outcome.message.slice(0, 600);
    case 'info':
      return extractInfoText(outcome.message, outcome.items).slice(0, 600);
    case 'chaos':
      return extractChaosText(outcome.result.headline, narration).slice(0, 600);
    case 'clarify':
      return outcome.question.slice(0, 600);
    case 'reply':
      return outcome.text.slice(0, 600);
  }
}

/**
 * Returns at most 5 context-aware prompt suggestions ordered deterministically by priority.
 * WHY: Provides rapid one-tap actions for hosts while adapting strictly to the current plan state.
 *
 * @param plan - Active EventPlan instance.
 * @param derived - Optional derived metrics selector output.
 * @returns Array of at most 5 prompt strings.
 */
export function suggestedPrompts(
  plan: EventPlan,
  derived?: EventDerivedMetrics,
): string[] {
  const prompts: string[] = [];

  // 1. concepts exist but none is selected -> "Pick option 1"
  if (plan.concepts.length > 0 && !plan.selectedConceptId) {
    prompts.push('Pick option 1');
  }

  // 2. "Increase guests from N to N+20" (N = the current count)
  const currentCount = plan.meta.guestCount;
  prompts.push(`Increase guests from ${currentCount} to ${currentCount + 20}`);

  // 3. "Where can I save ₹X?" (X = about 10% of the total, rounded to the nearest ₹5,000, at least ₹5,000)
  const total = derived?.budgetStatus.total ?? budgetTotal(plan.budgetItems, currentCount);
  const rawTarget = total * 0.1;
  const rounded = Math.round(rawTarget / 5000) * 5000;
  const saveAmount = Math.max(5000, rounded);
  prompts.push(`Where can I save ${formatInr(saveAmount)}?`);

  // 4. "What am I forgetting?"
  prompts.push('What am I forgetting?');

  // 5. the setting is not indoor -> "What if it rains?"
  if (plan.meta.setting !== 'indoor') {
    prompts.push('What if it rains?');
  }

  // 6. the cap exists -> "Can we fit a live singer into this budget?"
  const cap = derived?.budgetStatus.cap ?? getBudgetCap(plan.constraints);
  if (cap !== null) {
    prompts.push('Can we fit a live singer into this budget?');
  }

  // 7. "Make it feel expensive"
  prompts.push('Make it feel expensive');

  return prompts.slice(0, 5);
}

/**
 * Four predefined starter prompts for intake mode when no active event is open.
 */
export const INTAKE_PROMPTS: readonly string[] = [
  'Plan a wedding under ₹5 lakh',
  'Birthday party for 50 people in Pune, budget ₹80,000',
  'Anniversary for 80 guests in Mumbai under ₹1.5 lakh',
  'Community Diwali event for 200 people',
];
