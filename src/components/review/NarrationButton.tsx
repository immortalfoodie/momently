'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { requestNarration } from '@/lib/apiClient';
import type { FactValue, NarratePurpose } from '@/llm/schemas/narrate';

export interface NarrationButtonProps {
  purpose: NarratePurpose;
  /** Called on click so facts are built from the latest plan, not a stale render. */
  buildFacts: () => Record<string, FactValue>;
  label: string;
  regionLabel: string;
  className?: string;
}

const FAILURE_COPY = "I couldn't write the explanation, but the numbers above are unaffected.";

/**
 * On-demand plain-English explanation grounded only in engine-computed facts.
 * WHY: Hosts get a warm summary from the language model without any AI arithmetic in the
 * critical path; a failure leaves every number on screen untouched.
 */
export function NarrationButton({ purpose, buildFacts, label, regionLabel, className = '' }: NarrationButtonProps) {
  const [pending, setPending] = useState(false);
  const [explanation, setExplanation] = useState<{ text: string; highlights: string[] } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { announce } = useAnnouncer();

  const handleExplain = async () => {
    setPending(true);
    setErrorMessage(null);
    try {
      const res = await requestNarration({ purpose, facts: buildFacts() });
      if (res.ok) {
        setExplanation({ text: res.value.text, highlights: res.value.highlights });
        announce(`${regionLabel} ready.`);
      } else {
        setErrorMessage(FAILURE_COPY);
      }
    } catch {
      setErrorMessage(FAILURE_COPY);
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
        {pending ? 'Writing explanation…' : label}
      </Button>

      {errorMessage && (
        <p className="text-xs text-[#A12B3A] italic bg-[#FBE9EB] p-2.5 rounded-lg border border-[#F4C5CB]">
          {errorMessage}
        </p>
      )}

      {explanation && (
        <div
          role="region"
          aria-label={regionLabel}
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
