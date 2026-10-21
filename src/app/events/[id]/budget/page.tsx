import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Budget',
};

export default function BudgetPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Budget Guardian"
        description="Deterministic line-item ledger with real-time floor protection, provenance badges, and lever controls."
      />

      <EmptyState
        icon={<Icon name="wallet" size={28} aria-hidden="true" />}
        title="Budget Ledger"
        description="Comprehensive expense allocation with interactive quality levers, locked items, and dynamic contingency buffers."
      />
    </div>
  );
}
