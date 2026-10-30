'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { EventSetting, PlanImpact } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { resolveSteps } from '@/engine/assistant/resolveSteps';
import type { IntentOutput } from '@/llm/schemas/intent';
import { ConflictList } from '@/components/review/ConflictList';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { PAGE_COPY } from '@/lib/copy';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent, useStoreReady } from '@/store/selectors';
import { ConceptSummaryCard } from './ConceptSummaryCard';
import { EditDetailsDialog } from './EditDetailsDialog';
import { EventFactsCard } from './EventFactsCard';
import { ForgottenTeaser } from './ForgottenTeaser';
import { NextSteps } from './NextSteps';
import { ComplexOutcomeDialog, OverviewNav, OverviewSkeleton, RepriceImpactDialog } from './OverviewClientParts';
import { TopRisks } from './TopRisks';
import { VersionHistory } from './VersionHistory';

export interface OverviewClientProps {
  eventId?: string;
}

function useOverviewEvent(eventIdProp: string | undefined) {
  const context = useOptionalCurrentEvent();
  const params = useParams();
  const paramId = (params?.id as string) || '';
  const eventId = eventIdProp || context?.plan.id || paramId;

  const isReady = useStoreReady();
  const storeEvent = useEvent(eventId);
  const event = context?.event ?? storeEvent;
  return { eventId, isReady, event, plan: event?.plan };
}

/**
 * OverviewClient coordinates the holistic event hub, facts editing, and deep-linked audit views.
 * WHY: Answers "Where do we stand right now?" with deep links, two-phase editing, and version auditing.
 */
export function OverviewClient({ eventId: eventIdProp }: OverviewClientProps = {}) {
  const { eventId, isReady, event, plan } = useOverviewEvent(eventIdProp);
  const history = event?.history ?? [];

  const applyUserEdit = useEventsStore((s) => s.applyUserEdit);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [repriceImpact, setRepriceImpact] = useState<PlanImpact | null>(null);
  const [complexOutcome, setComplexOutcome] = useState<AssistantOutcome | null>(null);

  if (!isReady || !event || !plan) {
    return <OverviewSkeleton />;
  }

  const handleSaveSimple = async (changes: { title?: string; city?: string; dateIso?: string }) => {
    const res = applyUserEdit(
      eventId,
      [{ type: 'set_meta', changes }],
      'Updated event parameters',
      { recordSnapshot: true },
    );
    if (res.ok) {
      if (res.value.changedItems.length > 0) {
        setRepriceImpact(res.value);
      }
      return res.value;
    }
    return null;
  };

  const handleTriggerComplexFlow = (changes: { guestCount?: number; setting?: EventSetting }) => {
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    const latestPlan = useEventsStore.getState().events[eventId]?.plan ?? plan;
    const steps: IntentOutput[] = [];
    if (changes.guestCount !== undefined) {
      steps.push({ kind: 'change_guest_count', guestCount: changes.guestCount });
    }
    if (changes.setting !== undefined) {
      steps.push({ kind: 'set_setting', setting: changes.setting });
    }
    if (steps.length > 0) {
      setComplexOutcome(resolveSteps(latestPlan, steps, engineContext, today));
    }
  };

  return (
    <PageContainer width="full" className="space-y-8">
      <PageHeader
        title={PAGE_COPY.overview.title}
        description={PAGE_COPY.overview.description}
      />

      {/* Sticky navigation strip with scroll-margin-top links */}
      <OverviewNav />

      {/* Section 1: Facts */}
      <section id="facts" aria-labelledby="heading-facts" className="space-y-3">
        <h2 id="heading-facts" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Celebration Parameters
        </h2>
        <EventFactsCard plan={plan} onEdit={() => setIsEditOpen(true)} />
      </section>

      {/* Section 2: Concept */}
      <section id="concept" aria-labelledby="heading-concept" className="space-y-3">
        <h2 id="heading-concept" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Aesthetic Concept
        </h2>
        <ConceptSummaryCard plan={plan} eventId={eventId} />
      </section>

      {/* Section 3: Conflicts */}
      <section id="conflicts" aria-labelledby="heading-conflicts" className="space-y-3">
        <h2 id="heading-conflicts" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Plan Feasibility & Conflicts
        </h2>
        <ConflictList eventId={eventId} />
      </section>

      {/* Section 4: Risks */}
      <section id="risks" aria-labelledby="heading-risks" className="space-y-3">
        <h2 id="heading-risks" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Things to watch out for
        </h2>
        <TopRisks plan={plan} eventId={eventId} />
      </section>

      {/* Section 5: Next Steps */}
      <section id="next-steps" aria-labelledby="heading-next-steps" className="space-y-3">
        <h2 id="heading-next-steps" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Immediate Checklist Items
        </h2>
        <NextSteps plan={plan} eventId={eventId} />
      </section>

      {/* Section 6: Forgotten Costs Teaser */}
      <section id="forgotten" aria-labelledby="heading-forgotten" className="space-y-3">
        <h2 id="heading-forgotten" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Budget Reminders
        </h2>
        <ForgottenTeaser plan={plan} eventId={eventId} />
      </section>

      {/* Section 7: Version History */}
      <section id="history" aria-labelledby="heading-history" className="space-y-3">
        <h2 id="heading-history" className="text-lg font-serif font-bold text-ink scroll-mt-20">
          Audit Trail & Saved Versions
        </h2>
        <VersionHistory plan={plan} eventId={eventId} history={history} />
      </section>

      {/* Edit Details Dialog */}
      <EditDetailsDialog
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        plan={plan}
        onSaveSimple={handleSaveSimple}
        onTriggerComplexFlow={handleTriggerComplexFlow}
      />

      {/* City Tier Reprice Impact Dialog */}
      <RepriceImpactDialog impact={repriceImpact} onClose={() => setRepriceImpact(null)} />

      {/* Complex change proposal dialog */}
      <ComplexOutcomeDialog
        outcome={complexOutcome}
        eventId={eventId}
        plan={plan}
        onClose={() => setComplexOutcome(null)}
      />
    </PageContainer>
  );
}
