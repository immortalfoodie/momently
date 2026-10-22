import type { Metadata } from 'next';
import { EventsListClient } from '@/components/events/EventsListClient';

export const metadata: Metadata = {
  title: 'My Celebrations',
  description: 'View and manage all active, drafted, and completed celebration workspaces.',
};

export default function EventsPage() {
  return <EventsListClient />;
}
