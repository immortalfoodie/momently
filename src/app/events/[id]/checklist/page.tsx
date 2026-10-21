import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Checklist',
};

export default function ChecklistPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Planning Checklist"
        description="Prioritized action tasks categorized by due date offset and operational category."
      />

      <EmptyState
        icon={<Icon name="checklist" size={28} aria-hidden="true" />}
        title="Task Checklist"
        description="Categorized planning milestones from 90 days out to the eve of the event with status tracking."
      />
    </div>
  );
}
