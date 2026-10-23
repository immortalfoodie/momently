'use client';

import { useParams } from 'next/navigation';
import type { VendorNeed } from '@/domain/types';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEventsStore } from '@/store/eventsStore';
import { VendorNeedCard } from './VendorNeedCard';

export interface VendorsClientProps {
  eventId?: string;
}

function VendorsLoadingSkeleton() {
  return (
    <div className="py-2 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Vendors"
        description="Category requirements, vendor interview questions, and competitive quote comparisons."
      />
      <div className="space-y-4 pt-4">
        <Skeleton className="h-32 w-full rounded-[16px]" />
        <Skeleton className="h-64 w-full rounded-[16px]" />
      </div>
    </div>
  );
}

function VendorsSummaryBanner({
  bookedCount,
  totalVendors,
}: {
  bookedCount: number;
  totalVendors: number;
}) {
  return (
    <Card className="p-4 sm:p-5 bg-[#F5F2EB] border border-[#E6DCD2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="text-lg font-serif font-bold text-[#2B1B2E]">
          {bookedCount} of {totalVendors} vendors booked
        </p>
        <p className="text-xs text-[#5B4A5E]">
          Booking vendors lowers your Chaos Score when the event is within 30 days
        </p>
      </div>
    </Card>
  );
}

function VendorsContent({
  vendors,
  plan,
  targetEventId,
}: {
  vendors: VendorNeed[];
  plan: NonNullable<ReturnType<typeof useOptionalCurrentEvent>>['plan'];
  targetEventId: string;
}) {
  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="store" size={28} aria-hidden="true" />}
        title="No vendor categories"
        description="Your celebration template does not require any external vendors."
      />
    );
  }

  return (
    <div className="space-y-6">
      {vendors.map((need: VendorNeed) => (
        <VendorNeedCard
          key={need.id}
          plan={plan}
          need={need}
          eventId={targetEventId}
        />
      ))}
    </div>
  );
}

export function VendorsClient({ eventId: propEventId }: VendorsClientProps) {
  const params = useParams();
  const eventId = propEventId ?? (typeof params?.id === 'string' ? params.id : '');
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;

  if (!hydrated || !plan) {
    return <VendorsLoadingSkeleton />;
  }

  const targetEventId = eventId || plan.id;
  const vendors = plan.vendors;
  const bookedCount = vendors.filter((v: VendorNeed) => v.status === 'booked').length;

  return (
    <div className="py-2 space-y-8 max-w-3xl mx-auto">
      <PageHeader
        title="Vendors"
        description="Category requirements, vendor interview questions, and competitive quote comparisons."
      />

      <VendorsSummaryBanner bookedCount={bookedCount} totalVendors={vendors.length} />
      <VendorsContent vendors={vendors} plan={plan} targetEventId={targetEventId} />
    </div>
  );
}
