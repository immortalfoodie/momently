import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ChecklistClient } from '@/components/checklist/ChecklistClient';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Checklist',
  description: 'Prioritized milestone checklist categorized by operational urgency.',
};

export default function ChecklistPage() {
  return (
    <Suspense
      fallback={
        <div className="py-2 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <ChecklistClient />
    </Suspense>
  );
}
