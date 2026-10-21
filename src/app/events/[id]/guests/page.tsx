import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Guests',
};

export default function GuestsPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Guest Needs & Demographics"
        description="Dietary requirements, accessibility provisions, and demographic breakdown."
      />

      <EmptyState
        icon={<Icon name="users" size={28} aria-hidden="true" />}
        title="Guest Hospitality"
        description="Vegetarian, Jain, wheelchair access, and senior guest counts directly linked to catering and venue needs."
      />
    </div>
  );
}
