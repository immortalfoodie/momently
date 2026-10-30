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

interface ConceptFooterProps {
  total: number;
  cap: number | null;
  isSelected: boolean;
  onChoose: () => void;
}

function ConceptFooter({ total, cap, isSelected, onChoose }: ConceptFooterProps) {
  const isOver = cap !== null && total > cap;
  const overBy = cap !== null ? Math.max(0, total - cap) : 0;
  const spare = cap !== null ? Math.max(0, cap - total) : 0;
  return (
    <div className="border-border space-y-3 border-t pt-3">
      <div className="space-y-1.5">
        {cap !== null ? (
          <>
            <ProgressMeter
              value={total}
              max={cap}
              label={`Estimated total: ${formatInr(total)}`}
            />
            <p
              className={`text-xs font-medium ${isOver ? 'text-danger' : 'text-success'}`}
            >
              {isOver
                ? `Over cap by ${formatInr(overBy)}`
                : `${formatInr(spare)} to spare`}
            </p>
          </>
        ) : (
          <p className="text-ink text-xs font-medium">
            Estimated total: <Money amount={total} /> (No budget cap set)
          </p>
        )}
      </div>

      {isSelected ? (
        <Button disabled variant="secondary" className="w-full">
          Selected concept
        </Button>
      ) : (
        <Button variant="primary" className="w-full" onClick={onChoose}>
          Choose this concept
        </Button>
      )}
    </div>
  );
}

function ConceptDetails({ concept }: { concept: Concept }) {
  return (
    <>
      {concept.experienceHighlights.length > 0 && (
        <div className="space-y-1">
          <span className="text-ink text-xs font-semibold">Highlights</span>
          <ul
            className="text-ink-muted list-disc space-y-0.5 pl-5 text-xs"
            aria-label="Experience highlights"
          >
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
        <p className="text-ink-muted">
          <strong className="text-ink">Trade-off:</strong> {concept.tradeoffs}
        </p>
      </div>

      <div className="space-y-0.5 text-xs">
        <h3 className="text-ink font-semibold">Why it fits you</h3>
        <p className="text-ink-muted">{concept.whyItFits}</p>
      </div>
    </>
  );
}

/**
 * ConceptCard displays a comprehensive aesthetic direction for host evaluation.
 *
 * ACCESSIBILITY & PRICING DECISION (WHY):
 * Never uses stale persisted estimates: prices live against active plan items and guest counts.
 * Uses semantic heading structure with programmatic focus support for post-selection return.
 */
export function ConceptCard({
  concept,
  plan,
  isSelected,
  onChoose,
  headingRef,
  className = '',
}: ConceptCardProps) {
  // Plans are immutable, so the plan reference changes exactly when guests or quality change.
  const currentTotal = useMemo(
    () => priceConcept(plan, concept, engineContext),
    [plan, concept],
  );
  const cap = getBudgetCap(plan.constraints);

  return (
    <Card
      className={`border-border hover:border-primary flex flex-col justify-between space-y-4 bg-white p-5 shadow-xs transition-colors ${
        isSelected ? 'ring-primary border-transparent ring-2' : ''
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
            className="text-ink focus:ring-primary rounded text-lg font-bold outline-hidden focus:ring-2"
          >
            {concept.title}
          </h2>
          <p className="text-primary text-xs font-medium italic">{concept.tagline}</p>
        </div>

        <p className="text-ink-muted text-xs leading-relaxed">{concept.summary}</p>

        <ConceptDetails concept={concept} />
      </div>

      <ConceptFooter
        total={currentTotal}
        cap={cap}
        isSelected={isSelected}
        onChoose={() => onChoose(concept)}
      />
    </Card>
  );
}
