'use client';

import { useParams } from 'next/navigation';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { CopyFallbackDialog } from '@/components/ui/CopyFallbackDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCopyText } from '@/components/ui/useCopyText';
import { useEventsStore } from '@/store/eventsStore';
import { KitBriefsAndInvite } from './KitBriefsAndInvite';
import { KitDownloadsGrid } from './KitDownloadsGrid';
import { KitOrderQuantitiesCard } from './KitOrderQuantitiesCard';

export interface KitClientProps {
  eventId?: string;
}

function KitLoadingSkeleton() {
  return (
    <div className="py-2 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Event kit"
        description="Everything from your plan, ready to share or print. Made on your device."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-44 w-full rounded-[16px]" />
        <Skeleton className="h-44 w-full rounded-[16px]" />
        <Skeleton className="h-44 w-full rounded-[16px]" />
        <Skeleton className="h-44 w-full rounded-[16px]" />
      </div>
    </div>
  );
}

function resolveKitEventId(
  propEventId: string | undefined,
  paramId: unknown,
): string {
  if (propEventId) return propEventId;
  return typeof paramId === 'string' ? paramId : '';
}

export function KitClient({ eventId: propEventId }: KitClientProps) {
  const params = useParams();
  const eventId = resolveKitEventId(propEventId, params?.id);
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;

  const {
    copyText,
    fallbackOpen,
    fallbackText,
    fallbackTitle,
    fallbackDescription,
    closeFallback,
  } = useCopyText();

  if (!hydrated || !plan) {
    return <KitLoadingSkeleton />;
  }

  return (
    <div className="py-2 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Event kit"
        description="Everything from your plan, ready to share or print. Made on your device."
      />

      <KitDownloadsGrid plan={plan} eventId={plan.id} />

      <KitBriefsAndInvite plan={plan} onCopy={copyText} />

      <KitOrderQuantitiesCard plan={plan} onCopy={copyText} />

      <p className="text-xs text-[#5B4A5E] text-center pt-2">
        Momently never sends these anywhere. They stay on your device unless you share them.
      </p>

      {fallbackOpen && (
        <CopyFallbackDialog
          open={fallbackOpen}
          onClose={closeFallback}
          text={fallbackText}
          title={fallbackTitle}
          description={fallbackDescription}
        />
      )}
    </div>
  );
}
