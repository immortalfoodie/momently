import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ChaosLabClient } from '@/components/chaos/ChaosLabClient';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Chaos Lab',
  description: 'Stress-test your celebration before reality does.',
};

/**
 * Chaos Lab route presenting the complete disruption simulation laboratory.
 */
export default function ChaosLabPage() {
  return (
    <Suspense
      fallback={
        <div className="py-4 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <ChaosLabClient />
    </Suspense>
  );
}
