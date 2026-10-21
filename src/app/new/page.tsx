import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'New Event',
};

export default function NewEventPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Create New Event"
        description="Share a few details about your celebration vision. Momently synthesizes a complete, constraint-checked plan."
      />

      <EmptyState
        icon={<Icon name="sparkle" size={28} aria-hidden="true" />}
        title="Host Intake Studio"
        description="The natural language intake form will synthesize your event date, city, guest count, and creative priorities into a balanced plan."
      />
    </div>
  );
}
