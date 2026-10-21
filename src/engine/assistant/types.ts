import type { RecoveryOption, ScenarioResult } from '@/engine/chaos/types';
import type { Conflict } from '@/engine/conflicts';

export interface AssistantProposalOutcome {
  kind: 'proposal';
  message: string;
  options: RecoveryOption[];
  recommendedOptionId?: string;
  notes: string[];
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
