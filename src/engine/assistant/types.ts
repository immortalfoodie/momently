import type { RecoveryOption, ScenarioResult } from '@/engine/chaos/types';
import type { Conflict } from '@/engine/conflicts';

/**
 * One step of a compound chat request, shown in the "What I'll do" list.
 * planned = included in the proposal, checked = read-only answer or simulation, skipped = not done.
 */
export interface AssistantStepSummary {
  label: string;
  status: 'planned' | 'checked' | 'skipped';
  detail: string;
}

export interface AssistantProposalOutcome {
  kind: 'proposal';
  message: string;
  options: RecoveryOption[];
  recommendedOptionId?: string;
  notes: string[];
  steps?: AssistantStepSummary[];
}

export interface AssistantConflictOutcome {
  kind: 'conflict';
  message: string;
  conflicts: Conflict[];
  options: RecoveryOption[];
}

export interface AssistantInfoOutcome {
  kind: 'info';
  message: string;
  items: Array<{ title: string; detail: string }>;
  steps?: AssistantStepSummary[];
}

export interface AssistantChaosOutcome {
  kind: 'chaos';
  result: ScenarioResult;
}

export interface AssistantClarifyOutcome {
  kind: 'clarify';
  question: string;
}

export interface AssistantReplyOutcome {
  kind: 'reply';
  text: string;
}

export interface AssistantErrorOutcome {
  kind: 'error';
  message: string;
}

export type AssistantOutcome =
  | AssistantProposalOutcome
  | AssistantConflictOutcome
  | AssistantInfoOutcome
  | AssistantChaosOutcome
  | AssistantClarifyOutcome
  | AssistantReplyOutcome
  | AssistantErrorOutcome;

export interface AssistantError {
  message: string;
}
