import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { PlanImpact, PlanPatch } from '@/domain/types';
import type { SavingsPlan } from '@/engine/guardian';

export interface RecoveryOption {
  id: string;
  label: string;
  tradeoff: string;
  patch: PlanPatch; // status "proposed", source "chaos"
  impact: PlanImpact;
  scoreBefore: number;
  scoreAfter: number;
  approvalsRequired: string[];
  notes: string[];
  fundingOptions?: SavingsPlan[];
  meetsCap: boolean;
}

export interface ScenarioResult {
  input: ChaosScenarioInput;
  applicable: boolean;
  headline: string;
  summary: string;
  options: RecoveryOption[];
  recommendedOptionId?: string;
  scoreBefore: number;
}
