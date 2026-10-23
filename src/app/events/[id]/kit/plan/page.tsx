import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PrintablePlanClient } from '@/components/kit/PrintablePlan';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Printable plan | Momently',
  description: 'Clean, print-ready summary of your celebration plan.',
};

export default function PrintablePlanPage() {
  return (
    <Suspense
      fallback={
        <div className="py-2 space-y-6 max-w-4xl mx-auto">
          <PageHeader
            title="Printable plan"
            description="Clean, print-ready summary of your celebration plan."
          />
          <Skeleton className="h-96 w-full rounded-[16px]" />
        </div>
      }
    >
      <PrintablePlanClient />
    </Suspense>
  );
}
