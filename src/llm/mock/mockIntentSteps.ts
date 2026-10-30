import { MAX_INTENT_STEPS, type IntentInput, type IntentOutput, type IntentTaskOutput } from '@/llm/schemas/intent';
import { mockIntent } from './mockIntent';

const ACTION_VERBS =
  'what|tell|make|add|increase|decrease|upgrade|downgrade|save|set|change|simulate|lower|raise|cut|reduce|switch|pick|select|combine|find|can|check|show';

/**
 * Splits on ", and", "then", "also", or "and" followed by an action verb.
 * Commas inside numbers ("₹10,000") never split.
 */
const CLAUSE_SPLIT = new RegExp(
  String.raw`\s*(?:,(?!\d)\s*(?:and\s+|then\s+)?|;\s*|\band then\b|\bthen\b|\balso\b|\band\b(?=\s+(?:${ACTION_VERBS})\b))\s*`,
  'i',
);

const NON_ACTIONABLE = new Set<IntentOutput['kind']>(['clarify', 'answer', 'decline']);

/**
 * Splits a host message into clauses for compound-request detection.
 *
 * @param message - Raw host message.
 * @returns Non-empty trimmed clauses.
 */
export function splitClauses(message: string): string[] {
  return message
    .split(CLAUSE_SPLIT)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
}

/**
 * Offline compound-intent classifier wrapping the single-intent mock.
 * WHY: Keeps multi-step chat requests demoable without an API key. A message only becomes
 * `steps` when at least two clauses each map to an actionable intent.
 */
export function mockIntentSteps(input: IntentInput): IntentTaskOutput {
  const clauses = splitClauses(input.message);
  if (clauses.length >= 2) {
    const steps = clauses
      .map((clause) => mockIntent({ ...input, message: clause }))
      .filter((intent) => !NON_ACTIONABLE.has(intent.kind))
      .slice(0, MAX_INTENT_STEPS);
    if (steps.length >= 2) return { steps };
  }
  return mockIntent(input);
}
