'use client';

import { buildChaosFacts, type ScenarioResult } from '@/engine/chaos';
import { NarrationButton } from '@/components/review/NarrationButton';

export interface ExplainButtonProps {
  result: ScenarioResult;
  className?: string;
}

/**
 * On-demand narrative explanation button that grounds plain-English crisis summaries purely in verified engine facts.
 * WHY: The host may want a warm conversational explanation of the disruption without putting LLM math into the critical path.
 */
export function ExplainButton({ result, className = '' }: ExplainButtonProps) {
  return (
    <NarrationButton
      purpose="chaos_summary"
      buildFacts={() => buildChaosFacts(result)}
      label="Explain this in plain words"
      regionLabel="Plain-words summary"
      className={className}
    />
  );
}
