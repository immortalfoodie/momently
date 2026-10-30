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
import { Alert, Dialog, PageContainer, PageHeader } from '@/components/ui';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { PAGE_COPY } from '@/lib/copy';
import { OptionCard } from '@/components/review/OptionCard';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent } from '@/store/selectors';
import {
  AssumptionBanner,
  cityTierLabel,
  ConceptsBody,
  RefreshConfirmDialog,
  RefreshIdeasButton,
} from './ConceptsClientParts';
import { WhatIAssumedCard } from './WhatIAssumedCard';

function useConceptsEvent() {
  const context = useOptionalCurrentEvent();
  const params = useParams();
  const paramId = (params?.id as string) || '';
  const storeEvent = useEvent(paramId);

  const event = context?.event ?? storeEvent;
  const plan = context?.plan ?? storeEvent?.plan;
  const eventId = plan?.id ?? paramId;
  return { event, plan, eventId };
}

/**
 * ConceptsClient coordinates concept studio ideation, comparison, and deterministic switching.
 *
 * ACCESSIBILITY & STATE DECISION (WHY):
 * Restores keyboard focus to chosen concept heading post-approval, announces selection changes
 * to assistive technology, and ensures side-by-side matrices remain completely keyboard navigable.
 */
export function ConceptsClient() {
  const { event, plan, eventId } = useConceptsEvent();

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

  const headerActions =
    plan.concepts.length > 0 ? (
      <RefreshIdeasButton isGenerating={isGenerating} onClick={() => setConfirmRefreshOpen(true)} />
    ) : undefined;

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
      <AssumptionBanner
        guestCount={plan.meta.guestCount}
        tierLabel={cityTierLabel(tierForCity(plan.meta.city))}
      />

      {/* Concepts Empty State vs Cards Grid (Shown FIRST) */}
      <ConceptsBody
        plan={plan}
        isGenerating={isGenerating}
        onGenerate={handleFetchConcepts}
        onChoose={handleChooseConcept}
        setHeadingRef={(conceptId, el) => {
          headingRefs.current[conceptId] = el;
        }}
      />

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
      <RefreshConfirmDialog
        open={confirmRefreshOpen}
        isGenerating={isGenerating}
        onClose={() => setConfirmRefreshOpen(false)}
        onConfirm={handleFetchConcepts}
      />
    </PageContainer>
  );
}
