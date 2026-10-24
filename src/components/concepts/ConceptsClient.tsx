'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Concept } from '@/domain/types';
import { selectConceptOps } from '@/engine/assistant/concepts';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import { tierForCity } from '@/engine/pricing';
import { requestConcepts } from '@/lib/apiClient';
import { useOptionalCurrentEvent } from '@/components/events';
import { Alert, Button, Dialog, EmptyState, Icon, PageContainer, PageHeader } from '@/components/ui';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { PAGE_COPY } from '@/lib/copy';
import { OptionCard } from '@/components/review/OptionCard';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent } from '@/store/selectors';
import { CompareTable } from './CompareTable';
import { ConceptCard } from './ConceptCard';
import { MakeItYoursCard } from './MakeItYoursCard';
import { WhatIAssumedCard } from './WhatIAssumedCard';

/**
 * ConceptsClient coordinates concept studio ideation, comparison, and deterministic switching.
 *
 * ACCESSIBILITY & STATE DECISION (WHY):
 * Restores keyboard focus to chosen concept heading post-approval, announces selection changes
 * to assistive technology, and ensures side-by-side matrices remain completely keyboard navigable.
 */
// eslint-disable-next-line complexity
export function ConceptsClient() {
  const context = useOptionalCurrentEvent();
  const params = useParams();
  const paramId = (params?.id as string) || '';
  const storeEvent = useEvent(paramId);

  const event = context?.event ?? storeEvent;
  const plan = context?.plan ?? storeEvent?.plan;
  const eventId = plan?.id ?? paramId;

  const { announce } = useAnnouncer();
  const setConcepts = useEventsStore((s) => s.setConcepts);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [confirmRefreshOpen, setConfirmRefreshOpen] = useState(false);
  const [targetConcept, setTargetConcept] = useState<Concept | null>(null);
  const [targetOption, setTargetOption] = useState<RecoveryOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const headingRefs = useRef<Record<string, HTMLHeadingElement | null>>({});

  const handleFetchConcepts = async () => {
    if (!plan) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await requestConcepts(plan);
      if (res.ok) {
        setConcepts(eventId, res.value.concepts);
        announce(`Generated ${res.value.concepts.length} fresh celebration concepts.`);
      } else setGenerateError(res.error.message);
    } catch {
      setGenerateError('Unable to generate concepts right now. Please try again.');
    } finally {
      setIsGenerating(false);
      setConfirmRefreshOpen(false);
    }
  };

  const handleChooseConcept = (concept: Concept) => {
    if (!plan) return;
    const ops = selectConceptOps(plan, concept, engineContext);
    const option = buildOption(
      plan,
      ops,
      {
        id: `switch_${concept.id}`,
        label: `Switch to ${concept.title}`,
        tradeoff: concept.tradeoffs.join('; '),
      },
      engineContext,
    );

    if (option) {
      setTargetOption(option);
      setTargetConcept(concept);
      setDialogOpen(true);
    }
  };

  const handleConceptApproved = (option: RecoveryOption) => {
    void option;
    setDialogOpen(false);
    if (targetConcept) {
      const headingEl = headingRefs.current[targetConcept.id];
      headingEl?.focus();
      announce(`Selected concept: ${targetConcept.title}. Plan updated.`);
    }
  };

  if (!event || !plan) {
    return (
      <PageContainer width="full" className="space-y-6">
        <PageHeader
          title={PAGE_COPY.concepts.title}
          description={PAGE_COPY.concepts.description}
        />
      </PageContainer>
    );
  }

  const concepts = plan.concepts;

  const headerActions =
    concepts.length > 0 ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmRefreshOpen(true)}
        disabled={isGenerating}
        icon={<Icon name="sparkle" size={14} aria-hidden="true" />}
      >
        {isGenerating ? 'Refreshing...' : 'Refresh ideas'}
      </Button>
    ) : undefined;

  const cityTier = tierForCity(plan.meta.city);
  const cityTierLabel = cityTier === 'tier1' ? 'tier-1' : cityTier === 'tier3' ? 'tier-3' : 'tier-2';

  return (
    <PageContainer width="full" className="space-y-6">
      <PageHeader
        title={PAGE_COPY.concepts.title}
        description={PAGE_COPY.concepts.description}
        actions={headerActions}
      />

      {generateError && (
        <Alert tone="danger" title="Concept Generation Failed">
          {generateError}
        </Alert>
      )}

      {/* One-line summary banner linking to assumptions card below */}
      <div className="p-3 bg-[#FAF5F0] border border-[#E6DCD2] rounded-[10px] text-xs text-[#5B4A5E] flex items-center justify-between gap-2">
        <span>
          We assumed {plan.meta.guestCount} guests and {cityTierLabel} prices.{' '}
          <a
            href="#what-i-assumed"
            className="font-semibold text-[#6B2D5C] hover:underline cursor-pointer"
          >
            Review
          </a>
        </span>
      </div>

      {/* Concepts Empty State vs Cards Grid (Shown FIRST) */}
      {concepts.length === 0 ? (
        <EmptyState
          icon={<Icon name="bulb" size={28} aria-hidden="true" />}
          title="No concept directions yet"
          description="Generate 3 curated aesthetic and experiential directions tailored to your brief, venue, and budget."
          action={
            <Button
              variant="primary"
              onClick={handleFetchConcepts}
              disabled={isGenerating}
              icon={<Icon name="sparkle" size={16} aria-hidden="true" />}
            >
              {isGenerating ? 'Generating ideas...' : 'Generate ideas'}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                plan={plan}
                isSelected={plan.selectedConceptId === concept.id}
                onChoose={handleChooseConcept}
                headingRef={(el) => {
                  headingRefs.current[concept.id] = el;
                }}
              />
            ))}
          </div>

          <CompareTable concepts={concepts} plan={plan} />

          <MakeItYoursCard />
        </div>
      )}

      {/* Assumptions & Quick-Edits (Moved below concepts) */}
      <div id="what-i-assumed" className="scroll-mt-28">
        <WhatIAssumedCard
          eventId={eventId}
          assumptions={event.assumptions}
          missingInfo={event.missingInfo}
        />
      </div>

      {/* Choose Concept Approval Dialog */}
      {targetOption && (
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={`Review: ${targetOption.label}`}
        >
          <OptionCard
            option={targetOption}
            eventId={eventId}
            plan={plan}
            onApprove={handleConceptApproved}
            onDismiss={() => setDialogOpen(false)}
          />
        </Dialog>
      )}

      {/* Refresh Ideas Confirmation Dialog */}
      <Dialog
        open={confirmRefreshOpen}
        onClose={() => setConfirmRefreshOpen(false)}
        title="Refresh Celebration Concepts?"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#5C4556] leading-relaxed">
            Generating a fresh set of celebration concepts will replace current proposals.
            If your active selected concept is not included in the new set, the selection will be reset.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setConfirmRefreshOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFetchConcepts} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Yes, refresh ideas'}
            </Button>
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}
