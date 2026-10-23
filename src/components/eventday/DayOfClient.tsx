'use client';

import { useParams } from 'next/navigation';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEventsStore } from '@/store/eventsStore';
import { ContactsPanel } from './ContactsPanel';
import { DayTasks } from './DayTasks';
import { KeepScreenOn } from './KeepScreenOn';
import { ModeBanner } from './ModeBanner';
import { NowNext } from './NowNext';
import { ProblemSolver } from './ProblemSolver';
import { useEventDayClock } from './useEventDayClock';

export interface DayOfClientProps {
  eventId?: string;
}

function DayOfLoadingSkeleton() {
  return (
    <div className="py-2 space-y-6">
      <PageHeader
        title="Event day"
        description="Calm, real-time celebration coordination and live run-of-show tracking."
      />
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-[16px]" />
        <Skeleton className="h-48 w-full rounded-[16px]" />
        <Skeleton className="h-40 w-full rounded-[16px]" />
      </div>
    </div>
  );
}

export function DayOfClient({ eventId: propEventId }: DayOfClientProps) {
  const params = useParams();
  const eventId = propEventId ?? (typeof params?.id === 'string' ? params.id : '');
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;

  const clock = useEventDayClock(plan);

  if (!hydrated || !plan) {
    return <DayOfLoadingSkeleton />;
  }

  return (
    <div className="py-2 space-y-8 max-w-3xl mx-auto">
      <PageHeader
        title="Event day"
        description="Calm, phone-first coordinator showing active sessions, urgency milestones, and recovery options."
      />

      {/* 1. Right now */}
      <section aria-labelledby="right-now-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="right-now-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
            Right now
          </h2>
          <KeepScreenOn />
        </div>

        <ModeBanner
          plan={plan}
          mode={clock.mode}
          minute={clock.minute}
          canGoLive={clock.canGoLive}
          onGoLive={clock.goLive}
          onPractice={clock.practice}
          onSetPracticeMinute={clock.setPracticeMinute}
          onNudge={clock.nudge}
        />

        <NowNext plan={plan} minute={clock.minute} eventId={eventId} />
      </section>

      {/* 2. Today's to-do list */}
      <section aria-labelledby="today-todo-heading" className="space-y-3">
        <h2 id="today-todo-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          Today&apos;s to-do list
        </h2>
        <DayTasks plan={plan} eventId={eventId} />
      </section>

      {/* 3. Something went wrong? */}
      <section aria-labelledby="something-wrong-heading" className="space-y-3">
        <h2 id="something-wrong-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          Something went wrong?
        </h2>
        <ProblemSolver plan={plan} minute={clock.minute} eventId={eventId} />
      </section>

      {/* 4. Key contacts */}
      <section aria-labelledby="key-contacts-heading" className="space-y-3">
        <h2 id="key-contacts-heading" className="text-xl font-serif font-bold text-[#2B1B2E]">
          Key contacts
        </h2>
        <ContactsPanel plan={plan} eventId={eventId} />
      </section>
    </div>
  );
}
