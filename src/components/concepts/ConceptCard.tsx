'use client';

import { useMemo } from 'react';
import type { Concept, EventPlan } from '@/domain/types';
import { priceConcept } from '@/engine/assistant/concepts';
import { getBudgetCap } from '@/engine/budget';
import { formatInr } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CoverArt } from '@/components/ui/CoverArt';
import { Money } from '@/components/ui/Money';
import { PaletteSwatches } from '@/components/ui/PaletteSwatches';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { engineContext } from '@/store/engineContext';

export interface ConceptCardProps {
  concept: Concept;
  plan: EventPlan;
  isSelected: boolean;
  onChoose: (concept: Concept) => void;
  headingRef?: (el: HTMLHeadingElement | null) => void;
  className?: string;
}

/**
 * ConceptCard displays a comprehensive aesthetic direction for host evaluation.
 *
 * ACCESSIBILITY & PRICING DECISION (WHY):
 * Never uses stale persisted estimates: prices live against active plan items and guest counts.
 * Uses semantic heading structure with programmatic focus support for post-selection return.
 */
// eslint-disable-next-line complexity
export function ConceptCard({
  concept,
  plan,
  isSelected,
  onChoose,
  headingRef,
  className = '',
}: ConceptCardProps) {
  // Memoized on plan.version: reacts immediately to guest count or quality updates
  const currentTotal = useMemo(() => {
    return priceConcept(plan, concept, engineContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.version, concept]);

  const cap = getBudgetCap(plan.constraints);
  const isOver = cap !== null && currentTotal > cap;
  const overBy = cap !== null ? Math.max(0, currentTotal - cap) : 0;
  const spare = cap !== null ? Math.max(0, cap - currentTotal) : 0;

  return (
    <Card
      className={`flex flex-col justify-between p-5 border-[#E6DCD2] bg-white space-y-4 shadow-xs hover:border-[#6B2D5C] transition-colors ${
        isSelected ? 'ring-2 ring-[#6B2D5C] border-transparent' : ''
      } ${className}`}
    >
      <div className="space-y-3.5">
        <CoverArt seed={concept.id} palette={concept.palette} height={130} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PaletteSwatches palette={concept.palette} />
          {isSelected && <Badge tone="brand">Selected concept</Badge>}
        </div>

        <div className="space-y-1">
          <h2
            id={`concept-title-${concept.id}`}
            tabIndex={-1}
            ref={headingRef}
            className="text-lg font-bold text-[#2B1B2E] outline-hidden focus:ring-2 focus:ring-[#6B2D5C] rounded"
          >
            {concept.title}
          </h2>
          <p className="text-xs font-medium italic text-[#6B2D5C]">{concept.tagline}</p>
        </div>

        <p className="text-xs text-[#5C4556] leading-relaxed">{concept.summary}</p>

        {concept.experienceHighlights.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#2B1B2E]">Highlights</span>
            <ul className="list-disc pl-5 text-xs text-[#5C4556] space-y-0.5" aria-label="Experience highlights">
              {concept.experienceHighlights.map((highlight, index) => (
                <li key={index}>{highlight}</li>
              ))}
            </ul>
          </div>
        )}

        {concept.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Concept tags">
            {concept.tags.map((tag) => (
              <Badge key={tag} tone="neutral" className="text-2xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-1 text-xs">
          <p className="text-[#5C4556]">
            <strong className="text-[#2B1B2E]">Trade-off:</strong> {concept.tradeoffs}
          </p>
        </div>

        <div className="space-y-0.5 text-xs">
          <h3 className="font-semibold text-[#2B1B2E]">Why it fits you</h3>
          <p className="text-[#5C4556]">{concept.whyItFits}</p>
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-[#E6DCD2]">
        <div className="space-y-1.5">
          {cap !== null ? (
            <>
              <ProgressMeter
                value={currentTotal}
                max={cap}
                label={`Estimated total: ${formatInr(currentTotal)}`}
              />
              <p className={`text-xs font-medium ${isOver ? 'text-[#A12B3A]' : 'text-[#1F6F54]'}`}>
                {isOver ? `Over cap by ${formatInr(overBy)}` : `${formatInr(spare)} to spare`}
              </p>
            </>
          ) : (
            <p className="text-xs font-medium text-[#2B1B2E]">
              Estimated total: <Money amount={currentTotal} /> (No budget cap set)
            </p>
          )}
        </div>

        {isSelected ? (
          <Button disabled variant="secondary" className="w-full">
            Selected concept
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => onChoose(concept)}>
            Choose this concept
          </Button>
        )}
      </div>
    </Card>
  );
}
