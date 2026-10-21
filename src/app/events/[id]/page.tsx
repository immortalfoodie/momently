import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Event Overview',
};

export default function EventOverviewPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Event Overview"
        description="Holistic snapshot of milestone celebration parameters, active concept, and executive progress."
      />

      <EmptyState
        icon={<Icon name="sparkle" size={28} aria-hidden="true" />}
        title="Overview Dashboard"
        description="Executive summary cards, countdown clock, guest count metrics, and quick action shortcuts will live here."
      />
    </div>
  );
}
