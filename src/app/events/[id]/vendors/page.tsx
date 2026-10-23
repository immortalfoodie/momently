import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { VendorsClient } from '@/components/vendors/VendorsClient';

export const metadata: Metadata = {
  title: 'Vendors | Momently',
  description: 'Screening questions, quote tracking, and competitive comparisons across vendor categories.',
};

export default function VendorsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-2 space-y-6 max-w-3xl mx-auto">
          <Skeleton className="h-10 w-48 rounded-[12px]" />
          <Skeleton className="h-6 w-96 rounded-[8px]" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-40 w-full rounded-[16px]" />
          </div>
        </div>
      }
    >
      <VendorsClient />
    </Suspense>
  );
}
