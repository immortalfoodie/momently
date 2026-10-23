import type { FactValue } from '@/llm/schemas/narrate';
import type { ScenarioResult } from './types';

/**
 * Builds a structured, grounded record of plain facts from a ScenarioResult for the narrate task.
 * WHY: The LLM narrate pipeline strictly translates verified engine numbers and labels into prose,
 * never calculating or hallucinating values independently.
 *
 * @param result - Pure ScenarioResult from engine simulation.
 * @returns Record of FactValue items containing only numbers and strings from the engine result.
 */
export function buildChaosFacts(result: ScenarioResult): Record<string, FactValue> {
  const recommended =
    result.options.find((o) => o.id === result.recommendedOptionId) ?? result.options[0];

  const facts: Record<string, FactValue> = {
    headline: result.headline,
    scenario: result.headline,
    scoreBefore: result.scoreBefore,
    optionCount: result.options.length,
    optionsCount: result.options.length,
  };

  if (recommended) {
    facts.recommendedOptionLabel = recommended.label;
    facts.recovery = recommended.label;
    facts.scoreAfter = recommended.scoreAfter;
    facts.score = recommended.scoreAfter;
    facts.costDifference =
      recommended.impact.budgetTotalAfter - recommended.impact.budgetTotalBefore;
    facts.meetsCap = recommended.meetsCap ? 'true' : 'false';
  }

  result.options.forEach((opt, idx) => {
    facts[`option_${idx + 1}_label`] = opt.label;
    facts[`option_${idx + 1}_cost`] = opt.impact.budgetTotalAfter;
    facts[`option_${idx + 1}_diff`] =
      opt.impact.budgetTotalAfter - opt.impact.budgetTotalBefore;
  });

  return facts;
}
