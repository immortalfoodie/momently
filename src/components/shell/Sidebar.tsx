'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { useEventsStore } from '@/store/eventsStore';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const GLOBAL_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'New Event', href: '/new', icon: 'plus' },
  { label: 'My Events', href: '/events', icon: 'calendar' },
];

function getEventNavItems(eventId: string): NavItem[] {
  return [
    { label: 'Overview', href: `/events/${eventId}`, icon: 'sparkle' },
    { label: 'Concepts', href: `/events/${eventId}/concepts`, icon: 'bulb' },
    { label: 'Budget', href: `/events/${eventId}/budget`, icon: 'wallet' },
    { label: 'Timeline', href: `/events/${eventId}/timeline`, icon: 'clock' },
    { label: 'Checklist', href: `/events/${eventId}/checklist`, icon: 'checklist' },
    { label: 'Guests', href: `/events/${eventId}/guests`, icon: 'users' },
    { label: 'Vendors', href: `/events/${eventId}/vendors`, icon: 'store' },
    { label: 'Chaos Lab', href: `/events/${eventId}/chaos`, icon: 'storm' },
    { label: 'Event Day', href: `/events/${eventId}/day-of`, icon: 'calendar' },
  ];
}

function SidebarContent({ className = '', onNavigate }: SidebarProps) {
  const pathname = usePathname() || '/';

  // Detect /events/[id] context (excluding /events itself)
  const eventMatch = pathname.match(/^\/events\/([^/]+)/);
  const eventId = eventMatch?.[1];
  const isEventScope = typeof eventId === 'string' && eventId.length > 0;
  const eventNavItems = isEventScope ? getEventNavItems(eventId) : [];
  const eventTitle = useEventsStore((s) => (eventId ? s.events[eventId]?.plan.meta.title : undefined));

  return (
    <nav
      aria-label="Main"
      className={`w-64 bg-[#FBF7F2] border-r border-[#E6DCD2] flex flex-col p-4 gap-6 select-none shrink-0 ${className}`}
    >
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#5B4A5E] px-3 mb-2">
          Workspace
        </h2>
        <ul role="list" className="flex flex-col gap-1 p-0 m-0 list-none">
          {GLOBAL_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors border-l-4 no-underline ${
                    isActive
                      ? 'border-[#6B2D5C] bg-[#F4EDE6] text-[#6B2D5C] font-semibold'
                      : 'border-transparent text-[#2B1B2E] hover:bg-[#F4EDE6]/60 hover:text-[#2B1B2E]'
                  }`}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    className={isActive ? 'text-[#6B2D5C]' : 'text-[#5B4A5E]'}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {isEventScope ? (
        <div data-testid="event-nav-group">
          <div className="px-3 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5B4A5E]">
              This Event
            </h2>
            {eventTitle ? (
              <p
                data-testid="sidebar-event-title"
                className="text-sm font-semibold text-[#2B1B2E] truncate mt-1"
                title={eventTitle}
              >
                {eventTitle}
              </p>
            ) : null}
          </div>
          <ul role="list" className="flex flex-col gap-1 p-0 m-0 list-none">
            {eventNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors border-l-4 no-underline ${
                      isActive
                        ? 'border-[#6B2D5C] bg-[#F4EDE6] text-[#6B2D5C] font-semibold'
                        : 'border-transparent text-[#2B1B2E] hover:bg-[#F4EDE6]/60 hover:text-[#2B1B2E]'
                    }`}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      className={isActive ? 'text-[#6B2D5C]' : 'text-[#5B4A5E]'}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

/**
 * Primary sidebar navigation landmark wrapped in Suspense for Next.js prerendering.
 */
export function Sidebar(props: SidebarProps) {
  return (
    <Suspense
      fallback={
        <nav
          aria-label="Main"
          className={`w-64 bg-[#FBF7F2] border-r border-[#E6DCD2] flex flex-col p-4 gap-6 select-none shrink-0 ${
            props.className ?? ''
          }`}
        >
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5B4A5E] px-3 mb-2">
              Workspace
            </h2>
            <ul role="list" className="flex flex-col gap-1 p-0 m-0 list-none">
              {GLOBAL_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[#2B1B2E] border-l-4 border-transparent no-underline"
                  >
                    <Icon name={item.icon} size={18} className="text-[#5B4A5E]" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      }
    >
      <SidebarContent {...props} />
    </Suspense>
  );
}
