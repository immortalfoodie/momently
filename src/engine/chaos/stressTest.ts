import {
  CHAOS_SCENARIO_CATALOG,
  type ChaosScenarioInput,
} from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import type { EngineContext } from '@/engine/context';
import { scoreRisks } from '@/engine/risk';
import { defaultInputFor, scenarioAvailability } from './defaults';
import { simulateScenario } from './index';

export interface StressTestRow {
  type: ChaosScenarioInput['type'];
  label: string;
  applicable: boolean;
  headline: string;
  optionCount: number;
  bestOptionLabel?: string;
  scoreAfter?: number;
  costDelta?: number;
  meetsCap?: boolean;
}

export interface StressReport {
  scoreBefore: number;
  rows: StressTestRow[];
  weakestType?: ChaosScenarioInput['type'];
}

function resolveWeakestType(rows: StressTestRow[]): ChaosScenarioInput['type'] | undefined {
  const overCapRow = rows.find((r) => r.applicable && r.meetsCap === false);
  if (overCapRow) {
    return overCapRow.type;
  }

  let maxCostDelta = -Infinity;
  let highestDeltaType: ChaosScenarioInput['type'] | undefined;

  for (const row of rows) {
    if (row.applicable && typeof row.costDelta === 'number') {
      if (row.costDelta > maxCostDelta) {
        maxCostDelta = row.costDelta;
        highestDeltaType = row.type;
      }
    }
  }

  return highestDeltaType;
}

function evaluateStressRow(
  item: typeof CHAOS_SCENARIO_CATALOG[number],
  plan: EventPlan,
  ctx: EngineContext,
): StressTestRow {
  const avail = scenarioAvailability(plan, item.type);

  if (!avail.available) {
    return {
      type: item.type,
      label: item.label,
      applicable: false,
      headline: avail.reason ?? item.description,
      optionCount: 0,
    };
  }

  const input = defaultInputFor(plan, item.type);
  const result = simulateScenario(plan, input, ctx);

  if (!result.applicable || result.options.length === 0) {
    return {
      type: item.type,
      label: item.label,
      applicable: false,
      headline: result.headline,
      optionCount: result.options.length,
    };
  }

  const bestOption =
    result.options.find((o) => o.id === result.recommendedOptionId) ??
    [...result.options].sort((a, b) => a.scoreAfter - b.scoreAfter)[0];

  const costDelta = bestOption
    ? bestOption.impact.budgetTotalAfter - bestOption.impact.budgetTotalBefore
    : undefined;

  return {
    type: item.type,
    label: item.label,
    applicable: true,
    headline: result.headline,
    optionCount: result.options.length,
    bestOptionLabel: bestOption?.label,
    scoreAfter: bestOption?.scoreAfter,
    costDelta,
    meetsCap: bestOption?.meetsCap,
  };
}

/**
 * Runs all six chaos scenarios against an active plan and compiles a comparative resilience report.
 * WHY: Stress-tests the celebration plan across all risk dimensions in a single deterministic pass.
 *
 * @param plan - Active EventPlan to stress-test.
 * @param ctx - Deterministic engine context.
 * @returns Comprehensive StressReport with catalog-ordered rows and weakest disruption identified.
 */
export function runStressTest(plan: EventPlan, ctx: EngineContext): StressReport {
  const scoreBefore = scoreRisks(plan, ctx).score;
  const rows = CHAOS_SCENARIO_CATALOG.map((item) => evaluateStressRow(item, plan, ctx));
  const weakestType = resolveWeakestType(rows);

  return {
    scoreBefore,
    rows,
    weakestType,
  };
}
