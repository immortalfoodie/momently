import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Timeline',
};

export default function TimelinePage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Schedule & Timeline"
        description="Chronological event run-sheet with priority gating, duration bounds, and cascading delay ripple math."
      />

      <EmptyState
        icon={<Icon name="clock" size={28} aria-hidden="true" />}
        title="Event Run-Sheet"
        description="Dynamic minute-by-minute schedule slots with flexible duration dampening and delay simulation."
      />
    </div>
  );
}
