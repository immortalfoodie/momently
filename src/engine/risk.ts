import type { EventPlan, Risk } from '@/domain/types';
import type { EngineContext } from './context';
import type { EvaluatedRisk } from './riskRules';
import {
  checkBudgetRisks,
  checkCapacityAndSchedule,
  checkVendorAndPricingRisks,
  checkWeatherRisk,
} from './riskRules';

export { RISK_WEIGHTS } from './riskRules';

export type RiskBand = 'calm' | 'manageable' | 'exposed' | 'fragile';

export interface RiskReport {
  score: number;
  band: RiskBand;
  risks: Risk[];
  breakdown: Array<{ ruleId: string; points: number }>;
}

function calculateBand(score: number): RiskBand {
  if (score >= 75) return 'fragile';
  if (score >= 50) return 'exposed';
  if (score >= 25) return 'manageable';
  return 'calm';
}

function sortEvaluatedRisks(a: EvaluatedRisk, b: EvaluatedRisk): number {
  if (b.points !== a.points) return b.points - a.points;
  return a.risk.id.localeCompare(b.risk.id);
}

/**
 * Calculates a transparent 0-100 Chaos Score and risk breakdown for an EventPlan.
 * WHY: Provides hosts and algorithms with an objective index of fragility before executing changes.
 *
 * @param plan - Active EventPlan to inspect.
 * @param ctx - Injected engine context with pure clock.
 * @returns RiskReport with score (0-100), severity band, sorted risks, and rule point breakdown.
 */
export function scoreRisks(plan: EventPlan, ctx: EngineContext): RiskReport {
  const evaluated: EvaluatedRisk[] = [];

  const weatherRisk = checkWeatherRisk(plan);
  if (weatherRisk) evaluated.push(weatherRisk);

  evaluated.push(...checkBudgetRisks(plan));
  evaluated.push(...checkCapacityAndSchedule(plan));
  evaluated.push(...checkVendorAndPricingRisks(plan, ctx));

  const rawScore = evaluated.reduce((sum, item) => sum + item.points, 0);
  const score = Math.min(100, rawScore);
  const band = calculateBand(score);

  evaluated.sort(sortEvaluatedRisks);

  return {
    score,
    band,
    risks: evaluated.map((e) => e.risk),
    breakdown: evaluated.map((e) => ({ ruleId: e.ruleId, points: e.points })),
  };
}
