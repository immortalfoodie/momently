'use client';

import { Suspense, type ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { EventContextProvider } from '@/components/events';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import type { LinkTabItem } from '@/components/ui/Tabs';
import { LinkTabs } from '@/components/ui/Tabs';
import { PlanHealthStrip } from '@/components/plan/PlanHealthStrip';
import { useEvent, useEventDerived, useStoreReady } from '@/store/selectors';

export interface EventLayoutProps {
  children: ReactNode;
}

function EventSubnav({ eventId }: { eventId: string }) {
  const pathname = usePathname() || '';

  const tabItems: LinkTabItem[] = [
    { href: `/events/${eventId}`, label: 'Overview', isActive: pathname === `/events/${eventId}` },
    { href: `/events/${eventId}/concepts`, label: 'Concepts', isActive: pathname === `/events/${eventId}/concepts` },
    { href: `/events/${eventId}/budget`, label: 'Budget', isActive: pathname === `/events/${eventId}/budget` },
    { href: `/events/${eventId}/timeline`, label: 'Timeline', isActive: pathname === `/events/${eventId}/timeline` },
    { href: `/events/${eventId}/checklist`, label: 'Checklist', isActive: pathname === `/events/${eventId}/checklist` },
    { href: `/events/${eventId}/guests`, label: 'Guests', isActive: pathname === `/events/${eventId}/guests` },
    { href: `/events/${eventId}/vendors`, label: 'Vendors', isActive: pathname === `/events/${eventId}/vendors` },
    { href: `/events/${eventId}/chaos`, label: 'Chaos Lab', isActive: pathname === `/events/${eventId}/chaos` },
    { href: `/events/${eventId}/day-of`, label: 'Event Day', isActive: pathname === `/events/${eventId}/day-of` },
  ];

  return <LinkTabs items={tabItems} aria-label="Event workspace sections" />;
}

/**
 * Event workspace layout providing typed useCurrentEvent context and module navigation tabs.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Waits for browser storage hydration with accessible skeletons, handles unknown local event IDs
 * with a friendly fallback landmark, and provides persistent keyboard tabs.
 */
export default function EventLayout({ children }: EventLayoutProps) {
  const params = useParams();
  const id = (params?.id as string) || '';
  const hydrated = useStoreReady();
  const event = useEvent(id);
  const derived = useEventDerived(id);

  if (!hydrated) {
    return (
      <div data-testid="event-loading-skeleton" className="py-4 space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!event || !derived) {
    return (
      <div className="py-8 max-w-xl mx-auto">
        <EmptyState
          icon={<Icon name="alert" size={28} aria-hidden="true" />}
          title="We can't find this event in this browser"
          description="Plans are stored locally in your browser for privacy and offline convenience. This celebration might have been created on another device, or browser storage was cleared."
          level={2}
          action={
            <LinkButton href="/" variant="primary" icon={<Icon name="home" size={16} aria-hidden="true" />}>
              Return to Studio Home
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <EventContextProvider value={{ event, plan: event.plan, derived }}>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<div className="h-11 border-b border-[#E6DCD2]" />}>
          <EventSubnav eventId={id} />
        </Suspense>
        <PlanHealthStrip eventId={id} />
        <div>{children}</div>
      </div>
    </EventContextProvider>
  );
}
