'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EventCard } from '@/components/home/EventCard';
import { Button, LinkButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEventsStore } from '@/store/eventsStore';
import type { EventRecord } from '@/store/persistSchema';
import { useEventList, useStoreReady } from '@/store/selectors';

export function EventsListClient() {
  const router = useRouter();
  const hydrated = useStoreReady();
  const events = useEventList();
  const deleteEvent = useEventsStore((s) => s.deleteEvent);
  const createDemoEvent = useEventsStore((s) => s.createDemoEvent);
  const { announce } = useAnnouncer();

  const [deleteTarget, setDeleteTarget] = useState<EventRecord | null>(null);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const title = deleteTarget.plan.meta.title;
    deleteEvent(deleteTarget.plan.id);
    setDeleteTarget(null);
    announce(`Event deleted: ${title}`);
  };

  const handleLoadDemo = () => {
    const id = createDemoEvent();
    router.push(`/events/${id}/concepts`);
  };

  return (
    <div className="py-2">
      <PageHeader
        title="My Celebrations"
        description="View, manage, and inspect all celebration workspaces stored in this browser."
        actions={
          <LinkButton
            href="/new"
            variant="primary"
            icon={<Icon name="plus" size={16} aria-hidden="true" />}
          >
            New event
          </LinkButton>
        }
      />

      {!hydrated ? (
        <div data-testid="events-skeleton" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white rounded-[16px] border border-[#E6DCD2] p-5 shadow-2xs space-y-3"
            >
              <Skeleton className="h-32 w-full rounded-[12px]" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Icon name="calendar" size={28} aria-hidden="true" />}
          title="No celebrations found"
          description="You don't have any saved celebrations yet. Create a new plan or explore our benchmark 25th anniversary demo."
          level={2}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/new" variant="primary" size="sm">
                New event
              </LinkButton>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLoadDemo}
              >
                Load demo event
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard
              key={event.plan.id}
              event={event}
              headingLevel={2}
              action={
                <button
                  type="button"
                  onClick={() => setDeleteTarget(event)}
                  aria-label={`Delete event ${event.plan.meta.title}`}
                  className="p-1.5 rounded-lg text-[#5B4A5E] hover:text-[#A12B3A] hover:bg-[#FBE9EB] transition-colors cursor-pointer"
                >
                  <Icon name="close" size={16} aria-hidden="true" />
                </button>
              }
            />
          ))}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete celebration plan?"
        description={`This will permanently remove "${deleteTarget?.plan.meta.title}" from this browser. This action cannot be undone.`}
      >
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirmDelete}
          >
            Delete plan
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
