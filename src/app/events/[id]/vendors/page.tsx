import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Vendors',
};

export default function VendorsPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Vendor Needs & Quotes"
        description="Category requirements, vendor interview questions, and competitive quote comparisons."
      />

      <EmptyState
        icon={<Icon name="store" size={28} aria-hidden="true" />}
        title="Vendor Marketplace"
        description="Detailed requirement cards, customized vendor discovery questions, and quote tracking."
      />
    </div>
  );
}
