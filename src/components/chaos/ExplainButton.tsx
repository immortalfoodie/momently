'use client';

import { useState } from 'react';
import { buildChaosFacts, type ScenarioResult } from '@/engine/chaos';
import { requestNarration } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';

export interface ExplainButtonProps {
  result: ScenarioResult;
  className?: string;
}

/**
 * On-demand narrative explanation button that grounds plain-English crisis summaries purely in verified engine facts.
 * WHY: The host may want a warm conversational explanation of the disruption without putting LLM math into the critical path.
 */
export function ExplainButton({ result, className = '' }: ExplainButtonProps) {
  const [pending, setPending] = useState(false);
  const [explanation, setExplanation] = useState<{ text: string; highlights: string[] } | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExplain = async () => {
    setPending(true);
    setErrorMessage(null);

    try {
      const facts = buildChaosFacts(result);
      const res = await requestNarration({
        purpose: 'chaos_summary',
        facts,
      });

      if (res.ok) {
        setExplanation({
          text: res.value.text,
          highlights: res.value.highlights,
        });
      } else {
        setErrorMessage("I couldn't write the explanation, but the numbers above are unaffected.");
      }
    } catch {
      setErrorMessage("I couldn't write the explanation, but the numbers above are unaffected.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          void handleExplain();
        }}
      >
        {pending ? 'Writing explanation…' : 'Explain this in plain words'}
      </Button>

      {errorMessage && (
        <p className="text-xs text-[#A12B3A] italic bg-[#FBE9EB] p-2.5 rounded-lg border border-[#F4C5CB]">
          {errorMessage}
        </p>
      )}

      {explanation && (
        <div
          role="region"
          aria-label="Plain-words summary"
          className="p-4 rounded-xl bg-[#FAF5F0] border border-[#E6DCD2] space-y-2 text-xs text-[#2B1B2E]"
        >
          <p className="leading-relaxed whitespace-pre-wrap">{explanation.text}</p>
          {explanation.highlights.length > 0 && (
            <ul className="list-disc pl-5 space-y-0.5 text-[#5C4556]">
              {explanation.highlights.map((highlight, idx) => (
                <li key={idx} className="font-medium text-[#6B2D5C]">
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
