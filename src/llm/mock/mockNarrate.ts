import type { NarrateInput, NarrateOutput } from '@/llm/schemas/narrate';

interface NarratorResult {
  text: string;
  highlights: string[];
}

function narrateChaos(facts: Record<string, string | number | boolean | string[]>, title: string): NarratorResult {
  const scenario = typeof facts.scenario === 'string' ? facts.scenario : 'simulated crisis';
  const recovery = typeof facts.recovery === 'string' ? facts.recovery : 'contingency plan';
  const highlights = [`Scenario evaluated: ${scenario}`];
  if (facts.score !== undefined) {
    highlights.push(`Event resilience score: ${facts.score}/100`);
  }
  return {
    text: `We simulated the ${scenario} scenario for your ${title}. The recommended ${recovery} protects your primary celebration milestones while maintaining budget stability.`,
    highlights,
  };
}

function narrateBudget(facts: Record<string, string | number | boolean | string[]>, title: string): NarratorResult {
  const total = facts.total !== undefined ? `₹${facts.total}` : undefined;
  const remaining = facts.remaining !== undefined ? `₹${facts.remaining}` : undefined;
  const highlights: string[] = [];
  if (total) highlights.push(`Total budget: ${total}`);
  if (remaining) highlights.push(`Remaining buffer: ${remaining}`);
  return {
    text: `Here is the financial breakdown for your ${title}. Total estimated expenditure is ${total ?? 'balanced'}, with ${remaining ? `${remaining} remaining under your cap` : 'contingency reserves intact'}.`,
    highlights,
  };
}

function narrateChange(facts: Record<string, string | number | boolean | string[]>, title: string): NarratorResult {
  const change = typeof facts.change === 'string' ? facts.change : 'Requested plan updates';
  const guestCount = facts.guestCount !== undefined ? `${facts.guestCount} guests` : undefined;
  const highlights = [`Applied update: ${change}`];
  if (guestCount) highlights.push(`Updated count: ${guestCount}`);
  return {
    text: `The recent changes have been applied to your ${title}. ${change}. Your run-of-show and budget lines have been synchronized deterministically.`,
    highlights,
  };
}

function narrateChat(facts: Record<string, string | number | boolean | string[]>, title: string): NarratorResult {
  const message = typeof facts.message === 'string' ? facts.message : 'Your plan is updated and ready.';
  return {
    text: `${message} All figures and schedules reflect your latest host preferences for ${title}.`,
    highlights: ['Plan synchronized'],
  };
}

const NARRATORS: Record<string, (facts: Record<string, string | number | boolean | string[]>, title: string) => NarratorResult> = {
  chaos_summary: narrateChaos,
  budget_explainer: narrateBudget,
  change_summary: narrateChange,
  chat_reply: narrateChat,
};

/**
 * Deterministic mock implementation of narrative synthesis.
 * WHY: Generates grounded, friendly summaries from provided facts without external LLM calls.
 */
export function mockNarrate(input: NarrateInput): NarrateOutput {
  const title = typeof input.facts.title === 'string' ? input.facts.title : 'Celebration';
  const narrator = NARRATORS[input.purpose] ?? narrateChat;
  const result = narrator(input.facts, title);

  return {
    text: result.text.slice(0, 700),
    highlights: result.highlights.slice(0, 4).map((h) => h.slice(0, 120)),
  };
}
