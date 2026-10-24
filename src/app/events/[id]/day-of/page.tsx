import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DayOfClient } from '@/components/eventday/DayOfClient';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Event Day',
  description:
    "A calm, phone-friendly view for the day itself: what's on now, what's next, and what to do if something goes wrong.",
};

export default function DayOfPage() {
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
      <DayOfClient />
    </Suspense>
  );
}
