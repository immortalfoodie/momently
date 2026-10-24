import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PrintablePlanClient } from '@/components/kit/PrintablePlan';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { PAGE_COPY } from '@/lib/copy';

export const metadata: Metadata = {
  title: 'Printable plan | Momently',
  description: 'Clean, print-ready summary of your celebration plan.',
};

export default function PrintablePlanPage() {
  return (
    <Suspense
      fallback={
        <PageContainer width="full" className="space-y-6">
          <PageHeader
            title={PAGE_COPY.kitPlan.title}
            description={PAGE_COPY.kitPlan.description}
          />
          <Skeleton className="h-96 w-full rounded-[16px]" />
        </PageContainer>
      }
    >
      <PrintablePlanClient />
    </Suspense>
  );
}
