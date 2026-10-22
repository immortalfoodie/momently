'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { EventSetting, PlanImpact } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { ConflictList } from '@/components/review/ConflictList';
import { ImpactSummary } from '@/components/review/ImpactSummary';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEvent, useStoreReady } from '@/store/selectors';
import { ConceptSummaryCard } from './ConceptSummaryCard';
import { EditDetailsDialog } from './EditDetailsDialog';
import { EventFactsCard } from './EventFactsCard';
import { ForgottenTeaser } from './ForgottenTeaser';
import { NextSteps } from './NextSteps';
import { TopRisks } from './TopRisks';
import { VersionHistory } from './VersionHistory';

export interface OverviewClientProps {
  eventId?: string;
}

/**
 * OverviewClient coordinates the holistic event hub, facts editing, and deep-linked audit views.
 * WHY: Answers "Where do we stand right now?" with deep links, two-phase editing, and version auditing.
 */
// eslint-disable-next-line complexity
export function OverviewClient({ eventId: eventIdProp }: OverviewClientProps = {}) {
  const context = useOptionalCurrentEvent();
  const params = useParams();
  const paramId = (params?.id as string) || '';
  const eventId = eventIdProp || context?.plan.id || paramId;

  const isReady = useStoreReady();
  const storeEvent = useEvent(eventId);
  const event = context?.event ?? storeEvent;
  const plan = event?.plan;
  const history = event?.history ?? [];

  const applyUserEdit = useEventsStore((s) => s.applyUserEdit);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [repriceImpact, setRepriceImpact] = useState<PlanImpact | null>(null);
  const [complexOutcome, setComplexOutcome] = useState<AssistantOutcome | null>(null);

  if (!isReady || !event || !plan) {
    return (
      <div className="py-2 space-y-6">
        <PageHeader
          title="Celebration Overview"
          description="Holistic snapshot of milestone parameters, active aesthetic concept, and progress."
        />
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
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
    if (changes.guestCount !== undefined) {
      const outcome = resolveIntent(
        plan,
        { kind: 'change_guest_count', guestCount: changes.guestCount },
        engineContext,
        today,
      );
      setComplexOutcome(outcome);
    } else if (changes.setting !== undefined) {
      const outcome = resolveIntent(
        plan,
        { kind: 'set_setting', setting: changes.setting },
        engineContext,
        today,
      );
      setComplexOutcome(outcome);
    }
  };

  return (
    <div className="py-2 space-y-8">
      <PageHeader
        title="Celebration Overview"
        description="Holistic snapshot of milestone parameters, active aesthetic concept, and executive progress."
      />

      {/* Sticky navigation strip with scroll-margin-top links */}
      <nav aria-label="Overview sections" className="sticky top-0 z-10 bg-[#FAF5F0]/95 backdrop-blur-xs py-2 border-b border-[#E6DCD2]">
        <ul className="flex items-center gap-4 text-xs font-semibold text-[#5B4A5E] overflow-x-auto">
          <li><a href="#facts" className="hover:text-[#6B2D5C] hover:underline whitespace-nowrap">Facts</a></li>
          <li><a href="#concept" className="hover:text-[#6B2D5C] hover:underline whitespace-nowrap">Concept</a></li>
          <li><a href="#conflicts" className="hover:text-[#6B2D5C] hover:underline whitespace-nowrap">Conflicts</a></li>
          <li><a href="#risks" className="hover:text-[#6B2D5C] hover:underline whitespace-nowrap">Risks</a></li>
          <li><a href="#next-steps" className="hover:text-[#6B2D5C] hover:underline whitespace-nowrap">Next Steps</a></li>
          <li><a href="#history" className="hover:text-[#6B2D5C] hover:underline whitespace-nowrap">History</a></li>
        </ul>
      </nav>

      {/* Section 1: Facts */}
      <section id="facts" aria-labelledby="heading-facts" className="space-y-3">
        <h2 id="heading-facts" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
          Celebration Parameters
        </h2>
        <EventFactsCard plan={plan} onEdit={() => setIsEditOpen(true)} />
      </section>

      {/* Section 2: Concept */}
      <section id="concept" aria-labelledby="heading-concept" className="space-y-3">
        <h2 id="heading-concept" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
          Aesthetic Concept
        </h2>
        <ConceptSummaryCard plan={plan} eventId={eventId} />
      </section>

      {/* Section 3: Conflicts */}
      <section id="conflicts" aria-labelledby="heading-conflicts" className="space-y-3">
        <h2 id="heading-conflicts" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
          Plan Feasibility & Conflicts
        </h2>
        <ConflictList eventId={eventId} />
      </section>

      {/* Section 4: Risks */}
      <section id="risks" aria-labelledby="heading-risks" className="space-y-3">
        <h2 id="heading-risks" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
          Top Operational Vulnerabilities
        </h2>
        <TopRisks plan={plan} eventId={eventId} />
      </section>

      {/* Section 5: Next Steps */}
      <section id="next-steps" aria-labelledby="heading-next-steps" className="space-y-3">
        <h2 id="heading-next-steps" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
          Immediate Checklist Items
        </h2>
        <NextSteps plan={plan} eventId={eventId} />
      </section>

      {/* Section 6: Forgotten Costs Teaser */}
      <section id="forgotten" aria-labelledby="heading-forgotten" className="space-y-3">
        <h2 id="heading-forgotten" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
          Budget Reminders
        </h2>
        <ForgottenTeaser plan={plan} eventId={eventId} />
      </section>

      {/* Section 7: Version History */}
      <section id="history" aria-labelledby="heading-history" className="space-y-3">
        <h2 id="heading-history" className="text-lg font-serif font-bold text-[#2B1B2E] scroll-mt-20">
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
      <Dialog
        open={Boolean(repriceImpact)}
        onClose={() => setRepriceImpact(null)}
        title="Prices Re-estimated for City Rate Tier"
        description="Estimate items in your budget have been repriced based on your updated host city's vendor tier."
      >
        {repriceImpact && (
          <div className="pt-2 space-y-4">
            <ImpactSummary impact={repriceImpact} />
            <div className="flex justify-end pt-2 border-t border-[#E6DCD2]">
              <button
                type="button"
                onClick={() => setRepriceImpact(null)}
                className="px-4 py-2 bg-[#6B2D5C] text-white rounded-lg text-sm font-semibold hover:bg-[#5B254E]"
              >
                Acknowledge
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Complex change proposal dialog */}
      <Dialog
        open={Boolean(complexOutcome)}
        onClose={() => setComplexOutcome(null)}
        title="Proposed Parameter Adjustment"
        description="Headcount or setting adjustments require approval to evaluate resource constraints."
      >
        {complexOutcome && (
          <div className="pt-2">
            <AssistantOutcomeView
              outcome={complexOutcome}
              eventId={eventId}
              plan={plan}
              currentVersion={plan.version}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
