import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GuestsClient } from '@/components/guests/GuestsClient';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Guests | Momently',
  description: 'Manage guest demographics, dietary requirements, accessibility, and cultural traditions.',
};

export default function GuestsPage() {
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
      <GuestsClient />
    </Suspense>
  );
}
