import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Concepts',
};

export default function ConceptsPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Celebration Concepts"
        description="Review 3 differentiated aesthetic directions with palette swatches, trade-offs, and pre-computed pricing."
      />

      <EmptyState
        icon={<Icon name="bulb" size={28} aria-hidden="true" />}
        title="Concept Studio"
        description="Compare essential, balanced, and premium experience tiers with deterministic pricing and custom palette previews."
      />
    </div>
  );
}
