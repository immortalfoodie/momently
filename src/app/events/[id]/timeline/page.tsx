import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TimelineClient } from '@/components/timeline/TimelineClient';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'Chronological celebration schedule with duration safeguards and delay triage.',
};

export default function TimelinePage() {
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
      <TimelineClient />
    </Suspense>
  );
}
