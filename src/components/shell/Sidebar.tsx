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
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const GLOBAL_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'New Event', href: '/new', icon: 'plus' },
  { label: 'My Events', href: '/events', icon: 'calendar' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
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
    { label: 'Event kit', href: `/events/${eventId}/kit`, icon: 'download' },
  ];
}

interface NavListProps {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}

function NavList({ items, pathname, collapsed, compact = false, onNavigate }: NavListProps) {
  return (
    <ul role="list" className="flex flex-col gap-1 p-0 m-0 list-none">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-[10px] text-sm font-medium transition-colors border-l-4 no-underline ${compact ? 'py-2' : 'py-2.5'} ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                isActive
                  ? 'border-primary bg-surface-muted text-primary font-semibold'
                  : 'border-transparent text-ink hover:bg-surface-muted/60 hover:text-ink'
              }`}
            >
              <Icon
                name={item.icon}
                size={18}
                className={isActive ? 'text-primary' : 'text-ink-muted'}
                aria-hidden="true"
              />
              <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Expand workspace navigation' : 'Collapse workspace navigation'}
      aria-controls="workspace-navigation"
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      className="absolute right-0 top-1/2 z-20 flex h-14 w-5 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-border bg-white text-primary shadow-sm transition-colors hover:bg-surface-muted focus-visible:z-30"
    >
      <Icon name="chevron-right" size={15} className={collapsed ? '' : 'rotate-180'} aria-hidden="true" />
    </button>
  );
}

interface EventNavGroupProps {
  eventId: string;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}

function EventNavGroup({ eventId, pathname, collapsed, onNavigate }: EventNavGroupProps) {
  const eventTitle = useEventsStore((s) => s.events[eventId]?.plan.meta.title);
  return (
    <div data-testid="event-nav-group">
      <div className={`mb-2 px-3 ${collapsed ? 'sr-only' : ''}`}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">This Event</h2>
        {eventTitle ? (
          <p
            data-testid="sidebar-event-title"
            className="text-sm font-semibold text-ink truncate mt-1"
            title={eventTitle}
          >
            {eventTitle}
          </p>
        ) : null}
      </div>
      <NavList
        items={getEventNavItems(eventId)}
        pathname={pathname}
        collapsed={collapsed}
        compact
        onNavigate={onNavigate}
      />
    </div>
  );
}

function SidebarContent({
  className = '',
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname() || '/';

  // Detect /events/[id] context (excluding /events itself)
  const eventId = pathname.match(/^\/events\/([^/]+)/)?.[1];

  return (
    <nav
      id={onToggleCollapsed ? 'workspace-navigation' : undefined}
      aria-label="Main"
      className={`relative flex shrink-0 select-none flex-col border-r border-border bg-bg transition-[width,padding] duration-200 ease-out ${collapsed ? 'w-[76px] gap-6 p-2' : 'w-64 gap-6 p-4'} ${className}`}
    >
      <div>
        <h2 className={`mb-2 px-3 text-xs font-bold uppercase tracking-wider text-ink-muted ${collapsed ? 'sr-only' : ''}`}>
          Workspace
        </h2>
        <NavList items={GLOBAL_NAV_ITEMS} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      {eventId ? (
        <EventNavGroup eventId={eventId} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ) : null}

      {onToggleCollapsed ? <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} /> : null}
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
          className={`relative flex shrink-0 select-none flex-col border-r border-border bg-bg ${
            props.collapsed ? 'w-[76px] gap-6 p-2' : 'w-64 gap-6 p-4'
          } ${
            props.className ?? ''
          }`}
        >
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted px-3 mb-2">
              Workspace
            </h2>
            <ul role="list" className="flex flex-col gap-1 p-0 m-0 list-none">
              {GLOBAL_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-ink border-l-4 border-transparent no-underline"
                  >
                    <Icon name={item.icon} size={18} className="text-ink-muted" aria-hidden="true" />
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
