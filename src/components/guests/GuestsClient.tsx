'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { useEventsStore } from '@/store/eventsStore';
import { AccessCheck } from './AccessCheck';
import { GuestNeedsForm } from './GuestNeedsForm';
import { InsightsList } from './InsightsList';
import { MealPlanTable } from './MealPlanTable';
import { PreferencesManager } from './PreferencesManager';
import { PrivacyNote } from './PrivacyNote';

export interface GuestsClientProps {
  eventId?: string;
}

function GuestsLoadingSkeleton() {
  return (
    <div className="py-2 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Guests"
        description="Dietary requirements, accessibility provisions, demographic breakdown, and cultural traditions."
      />
      <div className="space-y-4 pt-4">
        <Skeleton className="h-40 w-full rounded-[16px]" />
        <Skeleton className="h-60 w-full rounded-[16px]" />
      </div>
    </div>
  );
}

export function GuestsClient({ eventId: propEventId }: GuestsClientProps) {
  const params = useParams();
  const eventId = propEventId ?? (typeof params?.id === 'string' ? params.id : '');
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;

  if (!hydrated || !plan) {
    return <GuestsLoadingSkeleton />;
  }

  const targetEventId = eventId || plan.id;

  return (
    <div className="py-2 space-y-8 max-w-3xl mx-auto">
      <PageHeader
        title="Guests"
        description="Dietary requirements, accessibility provisions, demographic breakdown, and cultural traditions."
      />

      {/* 1. Who's coming */}
      <section aria-labelledby="whos-coming-heading" className="space-y-4">
        <h2 id="whos-coming-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          Who&apos;s coming
        </h2>
        <PrivacyNote />
        <MealPlanTable plan={plan} />
      </section>

      {/* 2. What your guests need */}
      <section aria-labelledby="guest-needs-heading" className="space-y-4">
        <h2 id="guest-needs-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          What your guests need
        </h2>
        <GuestNeedsForm plan={plan} eventId={targetEventId} />
      </section>

      {/* 3. Reminders for you */}
      <section aria-labelledby="reminders-heading" className="space-y-4">
        <h2 id="reminders-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          Reminders for you
        </h2>
        <InsightsList plan={plan} eventId={targetEventId} />
        <AccessCheck plan={plan} eventId={targetEventId} />
      </section>

      {/* 4. Traditions and requirements */}
      <section aria-labelledby="traditions-heading" className="space-y-4">
        <h2 id="traditions-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          Traditions and requirements
        </h2>
        <PreferencesManager plan={plan} eventId={targetEventId} />
      </section>
    </div>
  );
}
