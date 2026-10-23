'use client';

import { useEffect, useRef } from 'react';
import type { EventPlan } from '@/domain/types';
import type { ScenarioResult } from '@/engine/chaos';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { OptionCard } from '@/components/review/OptionCard';
import { ScoreDelta } from '@/components/review/ScoreDelta';
import { BeforeAfter } from './BeforeAfter';
import { ExplainButton } from './ExplainButton';

export interface ScenarioResultViewProps {
  plan: EventPlan;
  eventId: string;
  result: ScenarioResult;
  versionSimulatedAgainst: number;
  onResimulate?: () => void;
  onOptionApplied?: (result: { scoreBefore: number; scoreAfter: number; budgetTotalAfter: number }) => void;
  className?: string;
}

/**
 * ScenarioResultView displays simulation outcomes, recommended deltas, side-by-side comparisons,
 * and staleness detection when the active plan revision advances.
 */
export function ScenarioResultView({
  plan,
  eventId,
  result,
  versionSimulatedAgainst,
  onResimulate,
  onOptionApplied,
  className = '',
}: ScenarioResultViewProps) {
  const { announce } = useAnnouncer();
  const headlineRef = useRef<HTMLHeadingElement | null>(null);

  const isStale = plan.version !== versionSimulatedAgainst;
  const recommended = result.options.find((o) => o.id === result.recommendedOptionId) ?? result.options[0];
  const sortedOptions = [...result.options].sort((a, b) => {
    if (a.id === result.recommendedOptionId) return -1;
    if (b.id === result.recommendedOptionId) return 1;
    return 0;
  });

  useEffect(() => {
    if (headlineRef.current) {
      headlineRef.current.focus();
    }
    announce(`Simulation ready: ${result.options.length} recovery options`);
  }, [result, announce]);

  if (!result.applicable) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert tone="info">
          <p className="font-semibold text-sm mb-1">Scenario Inapplicable</p>
          <h3 ref={headlineRef} tabIndex={-1} className="outline-hidden font-semibold">
            {result.headline}
          </h3>
          <p className="text-xs mt-1 text-[#5C4556]">{result.summary}</p>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isStale ? 'opacity-65' : ''} ${className}`}>
      <Card className="p-6 border-[#E6DCD2] bg-white space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                ref={headlineRef}
                tabIndex={-1}
                className="text-lg font-serif font-bold text-[#2B1B2E] outline-hidden"
              >
                {result.headline}
              </h3>
              {isStale && <Badge tone="neutral">Out of date</Badge>}
            </div>
            <p className="text-xs text-[#5C4556] leading-relaxed">{result.summary}</p>
          </div>

          {isStale && onResimulate && (
            <Button size="sm" variant="secondary" onClick={onResimulate} className="shrink-0">
              Simulate again
            </Button>
          )}
        </div>

        {recommended && (
          <div className="pt-2 border-t border-[#F4EDE6] flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-[#5C4556]">Recommended outcome:</span>
            <ScoreDelta scoreBefore={result.scoreBefore} scoreAfter={recommended.scoreAfter} />
          </div>
        )}

        <div className="pt-1">
          <ExplainButton result={result} />
        </div>
      </Card>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-[#2B1B2E]">
          Recovery options ({result.options.length})
        </p>

        <div className="space-y-4">
          {sortedOptions.map((option) => (
            <div key={option.id} className="space-y-2">
              <OptionCard
                option={option}
                eventId={eventId}
                plan={plan}
                isRecommended={option.id === result.recommendedOptionId}
                disabled={isStale}
                onApprove={() => {
                  onOptionApplied?.({
                    scoreBefore: result.scoreBefore,
                    scoreAfter: option.scoreAfter,
                    budgetTotalAfter: option.impact.budgetTotalAfter,
                  });
                }}
              />

              <details className="group border border-[#E6DCD2] rounded-lg bg-white p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-[#6B2D5C] hover:text-[#55224A] select-none flex items-center justify-between">
                  <span>Compare with current plan</span>
                  <span className="text-[#5C4556] group-open:rotate-180 transition-transform" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div className="mt-3">
                  <BeforeAfter plan={plan} option={option} />
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
