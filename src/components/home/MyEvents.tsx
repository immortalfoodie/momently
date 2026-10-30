'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEventsStore } from '@/store/eventsStore';
import { useEventList, useStoreReady } from '@/store/selectors';
import { EventCard } from './EventCard';

export function MyEvents() {
  const router = useRouter();
  const hydrated = useStoreReady();
  const events = useEventList();
  const createDemoEvent = useEventsStore((s) => s.createDemoEvent);

  const handleLoadDemo = () => {
    const id = createDemoEvent();
    router.push(`/events/${id}/concepts`);
  };

  return (
    <section aria-labelledby="my-celebrations-heading" className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5A00]">YOUR WORKSPACE</p>
          <h2
            id="my-celebrations-heading"
            className="mt-1 font-serif text-2xl font-bold text-[#2B1B2E]"
          >
            My Celebrations
          </h2>
          <p className="text-sm text-[#5B4A5E] mt-0.5">
            Your active and upcoming event planning workspaces.
          </p>
        </div>

        {hydrated && events.length > 0 ? (
          <Link
            href="/events"
            className="text-sm font-semibold text-[#6B2D5C] hover:text-[#55224A] hover:underline focus-visible:outline-hidden"
          >
            View all ({events.length})
          </Link>
        ) : null}
      </div>

      {!hydrated ? (
        <div data-testid="events-skeleton" role="status" aria-label="Loading your celebrations" aria-busy="true" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`space-y-3 rounded-[16px] border border-[#E6DCD2] bg-white p-4 shadow-[0_2px_8px_rgba(43,27,46,0.03)] ${idx > 1 ? 'hidden md:block' : ''}`}
            >
              <Skeleton className="h-24 w-full rounded-[12px]" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-4 h-2 w-full" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" size={28} aria-hidden="true" />}
          title="No celebrations planned yet"
          description="Start with a fresh idea or load the benchmark 25th anniversary demo to see Momently's intelligence engine in action."
          level={3}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/new" variant="primary" size="sm">
                Plan a new event
              </LinkButton>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLoadDemo}
              >
                Load the demo event
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.slice(0, 3).map((event) => (
            <EventCard key={event.plan.id} event={event} headingLevel={3} />
          ))}
        </div>
      )}
    </section>
  );
}
