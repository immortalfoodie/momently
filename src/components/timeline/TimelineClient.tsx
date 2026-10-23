'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEventsStore } from '@/store/eventsStore';
import type { EventPlan } from '@/domain/types';
import { DelayPlanner } from './DelayPlanner';
import { PrepCountdown } from './PrepCountdown';
import { RunOfShow } from './RunOfShow';
import { ShiftSchedule } from './ShiftSchedule';
import { SlotDialog } from './SlotDialog';

export interface TimelineClientProps {
  eventId?: string;
}

function PrintHeader({ title, dateIso }: { title: string; dateIso?: string }) {
  return (
    <div className="hidden print:block mb-6 border-b pb-4">
      <h1 className="text-2xl font-serif font-bold text-black">{title} — Run of Show</h1>
      <p className="text-sm text-gray-700 mt-1">Date: {dateIso ?? 'Not specified'}</p>
    </div>
  );
}

function TimelineScheduleSections({ plan, eventId }: { plan: EventPlan; eventId: string }) {
  if (plan.schedule.length === 0) return null;
  return (
    <>
      <section aria-labelledby="delay-heading" data-print-hide className="space-y-2 no-print">
        <h2 id="delay-heading" className="text-base font-semibold text-[#2B1B2E]">
          Something running late?
        </h2>
        <DelayPlanner plan={plan} eventId={eventId} />
      </section>

      <section aria-labelledby="adjust-heading" data-print-hide className="space-y-2 no-print">
        <h2 id="adjust-heading" className="text-base font-semibold text-[#2B1B2E]">
          Move or adjust
        </h2>
        <ShiftSchedule plan={plan} eventId={eventId} />
      </section>
    </>
  );
}

function TimelineLoadingSkeleton() {
  return (
    <div className="py-2 space-y-6">
      <PageHeader title="Timeline" description="Chronological milestone run-sheet with cascading delay triage." />
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-[16px]" />
        <Skeleton className="h-64 w-full rounded-[16px]" />
      </div>
    </div>
  );
}

function RunOfShowSection({
  plan,
  eventId,
  onAddSession,
}: {
  plan: EventPlan;
  eventId: string;
  onAddSession: () => void;
}) {
  return (
    <section aria-labelledby="run-of-show-heading" className="space-y-3">
      <div className="flex items-center justify-between no-print" data-print-hide>
        <h2 id="run-of-show-heading" className="text-base font-semibold text-[#2B1B2E]">
          Run of show
        </h2>
      </div>

      {plan.schedule.length === 0 ? (
        <EmptyState
          icon={<Icon name="clock" size={28} aria-hidden="true" />}
          title="Add the first session"
          description="Your celebration timeline has no activities yet. Add your first session to begin the run-sheet."
          action={
            <Button variant="primary" onClick={onAddSession}>
              Add the first session
            </Button>
          }
        />
      ) : (
        <RunOfShow plan={plan} eventId={eventId} />
      )}
    </section>
  );
}

export function TimelineClient({ eventId: propEventId }: TimelineClientProps) {
  const params = useParams();
  const eventId = propEventId ?? (typeof params?.id === 'string' ? params.id : '');
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  if (!hydrated || !plan) {
    return <TimelineLoadingSkeleton />;
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="py-2 space-y-8">
      <PrintHeader title={plan.meta.title} dateIso={plan.meta.dateIso} />

      <div data-print-hide className="no-print">
        <PageHeader
          title="Timeline"
          description="Chronological celebration schedule with duration safeguards and delay triage."
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handlePrint}>
                <span className="flex items-center gap-1.5">
                  <Icon name="download" size={16} aria-hidden="true" />
                  <span>Print run of show</span>
                </span>
              </Button>
              <Button variant="primary" onClick={() => setAddDialogOpen(true)}>
                Add session
              </Button>
            </div>
          }
        />
      </div>

      <section aria-labelledby="countdown-heading" data-print-hide className="space-y-2 no-print">
        <h2 id="countdown-heading" className="text-base font-semibold text-[#2B1B2E]">
          Countdown
        </h2>
        <PrepCountdown plan={plan} eventId={eventId} />
      </section>

      <RunOfShowSection plan={plan} eventId={eventId} onAddSession={() => setAddDialogOpen(true)} />

      <TimelineScheduleSections plan={plan} eventId={eventId} />

      {addDialogOpen && (
        <SlotDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          eventId={eventId}
        />
      )}
    </div>
  );
}
