'use client';

import { Suspense, type ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import type { LinkTabItem } from '@/components/ui/Tabs';
import { LinkTabs } from '@/components/ui/Tabs';

export interface EventLayoutProps {
  children: ReactNode;
}

function EventSubnav() {
  const params = useParams();
  const pathname = usePathname() || '';
  const id = (params?.id as string) || 'demo';

  const tabItems: LinkTabItem[] = [
    { href: `/events/${id}`, label: 'Overview', isActive: pathname === `/events/${id}` },
    { href: `/events/${id}/concepts`, label: 'Concepts', isActive: pathname === `/events/${id}/concepts` },
    { href: `/events/${id}/budget`, label: 'Budget', isActive: pathname === `/events/${id}/budget` },
    { href: `/events/${id}/timeline`, label: 'Timeline', isActive: pathname === `/events/${id}/timeline` },
    { href: `/events/${id}/checklist`, label: 'Checklist', isActive: pathname === `/events/${id}/checklist` },
    { href: `/events/${id}/guests`, label: 'Guests', isActive: pathname === `/events/${id}/guests` },
    { href: `/events/${id}/vendors`, label: 'Vendors', isActive: pathname === `/events/${id}/vendors` },
    { href: `/events/${id}/chaos`, label: 'Chaos Lab', isActive: pathname === `/events/${id}/chaos` },
    { href: `/events/${id}/day-of`, label: 'Event Day', isActive: pathname === `/events/${id}/day-of` },
  ];

  return <LinkTabs items={tabItems} aria-label="Event workspace sections" />;
}

/**
 * Event workspace layout providing sub-navigation tabs across all event modules.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Renders semantic navigation links via `<LinkTabs>` with `aria-label="Event workspace sections"`
 * and `aria-current="page"` indicating the active module without color reliance.
 */
export default function EventLayout({ children }: EventLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-11 border-b border-[#E6DCD2]" />}>
        <EventSubnav />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
