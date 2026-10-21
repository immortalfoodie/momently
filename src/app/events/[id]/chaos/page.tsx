import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Chaos Lab',
};

export default function ChaosLabPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="Chaos Simulation Lab"
        description="Stress-test your event against realistic disruptions: weather shocks, budget cuts, vendor dropouts, and delays."
      />

      <EmptyState
        icon={<Icon name="storm" size={28} aria-hidden="true" />}
        title="Contingency Stress-Testing"
        description="Run simulated disruption scenarios to preview impact scores, cost deltas, and approvable recovery options."
      />
    </div>
  );
}
