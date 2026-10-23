import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KitClient } from '@/components/kit/KitClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Event kit | Momently',
  description: 'Everything from your plan, ready to share or print. Made on your device.',
};

export default function EventKitPage() {
  return (
    <Suspense
      fallback={
        <div className="py-2 space-y-6 max-w-4xl mx-auto">
          <PageHeader
            title="Event kit"
            description="Everything from your plan, ready to share or print. Made on your device."
          />
          <Skeleton className="h-64 w-full rounded-[16px]" />
        </div>
      }
    >
      <KitClient />
    </Suspense>
  );
}
