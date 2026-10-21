import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Event Day',
};

export default function DayOfPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Event Day Run-Sheet"
        description="High-contrast execution kit for hosts and on-site coordinators, optimized for mobile screens and print."
      />

      <EmptyState
        icon={<Icon name="calendar" size={28} aria-hidden="true" />}
        title="Live Day-Of Studio"
        description="Active timeline tracking, vendor emergency contacts, printable event run-sheets, and quick delay adjustments."
      />
    </div>
  );
}
