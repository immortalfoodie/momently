'use client';

import type { CityTier, Concept, EventPlan } from '@/domain/types';
import { Button, Dialog, EmptyState, Icon } from '@/components/ui';
import { CompareTable } from './CompareTable';
import { ConceptCard } from './ConceptCard';
import { MakeItYoursCard } from './MakeItYoursCard';

export function cityTierLabel(cityTier: CityTier): string {
  if (cityTier === 'tier1') return 'tier-1';
  if (cityTier === 'tier3') return 'tier-3';
  return 'tier-2';
}

interface RefreshIdeasButtonProps {
  isGenerating: boolean;
  onClick: () => void;
}

export function RefreshIdeasButton({ isGenerating, onClick }: RefreshIdeasButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={isGenerating}
      icon={<Icon name="sparkle" size={14} aria-hidden="true" />}
    >
      {isGenerating ? 'Refreshing...' : 'Refresh ideas'}
    </Button>
  );
}

interface AssumptionBannerProps {
  guestCount: number;
  tierLabel: string;
}

export function AssumptionBanner({ guestCount, tierLabel }: AssumptionBannerProps) {
  return (
    <div className="p-3 bg-surface-warm border border-border rounded-[10px] text-xs text-ink-muted flex items-center justify-between gap-2">
      <span>
        We assumed {guestCount} guests and {tierLabel} prices.{' '}
        <a
          href="#what-i-assumed"
          className="font-semibold text-primary hover:underline cursor-pointer"
        >
          Review
        </a>
      </span>
    </div>
  );
}

interface ConceptsBodyProps {
  plan: EventPlan;
  isGenerating: boolean;
  onGenerate: () => void;
  onChoose: (concept: Concept) => void;
  setHeadingRef: (conceptId: string, el: HTMLHeadingElement | null) => void;
}

export function ConceptsBody({ plan, isGenerating, onGenerate, onChoose, setHeadingRef }: ConceptsBodyProps) {
  const concepts = plan.concepts;
  if (concepts.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="bulb" size={28} aria-hidden="true" />}
        title="No concept directions yet"
        description="Generate 3 curated aesthetic and experiential directions tailored to your brief, venue, and budget."
        action={
          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={isGenerating}
            icon={<Icon name="sparkle" size={16} aria-hidden="true" />}
          >
            {isGenerating ? 'Generating ideas...' : 'Generate ideas'}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {concepts.map((concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
            plan={plan}
            isSelected={plan.selectedConceptId === concept.id}
            onChoose={onChoose}
            headingRef={(el) => setHeadingRef(concept.id, el)}
          />
        ))}
      </div>

      <CompareTable concepts={concepts} plan={plan} />

      <MakeItYoursCard />
    </div>
  );
}

interface RefreshConfirmDialogProps {
  open: boolean;
  isGenerating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RefreshConfirmDialog({ open, isGenerating, onClose, onConfirm }: RefreshConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Refresh Celebration Concepts?">
      <div className="space-y-4">
        <p className="text-xs text-ink-muted leading-relaxed">
          Generating a fresh set of celebration concepts will replace current proposals.
          If your active selected concept is not included in the new set, the selection will be reset.
        </p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Yes, refresh ideas'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
