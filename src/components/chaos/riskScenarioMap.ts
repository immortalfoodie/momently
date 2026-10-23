import type { ChaosScenarioInput } from '@/domain/chaosSchemas';

/**
 * Deterministic mapping from engine risk rule IDs to their corresponding chaos disruption scenario types.
 */
export const RISK_TO_SCENARIO_MAP: Record<string, ChaosScenarioInput['type']> = {
  weather_uncovered: 'rain',
  budget_tight: 'budget_cut',
  budget_exceeded: 'budget_cut',
  vendors_unbooked: 'vendor_cancels',
  schedule_no_slack: 'late_start',
  guest_limit_exceeded: 'guest_surge',
};

/**
 * Resolves a scenario type for a given risk rule ID or risk ID.
 */
export function getScenarioForRisk(riskIdOrRuleId: string): ChaosScenarioInput['type'] | undefined {
  if (RISK_TO_SCENARIO_MAP[riskIdOrRuleId]) {
    return RISK_TO_SCENARIO_MAP[riskIdOrRuleId];
  }
  const stripped = riskIdOrRuleId.replace(/^risk_/, '');
  return RISK_TO_SCENARIO_MAP[stripped];
}
