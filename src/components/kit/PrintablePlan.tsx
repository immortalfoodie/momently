'use client';

import { useParams } from 'next/navigation';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  buildPlanDocument,
  type PlanDocument,
} from '@/lib/export/planDocument';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { PrintablePlanDetails } from './PrintablePlanDetails';
import { PrintablePlanTables } from './PrintablePlanTables';

export interface PrintablePlanProps {
  doc: PlanDocument;
}

/**
 * Semantic, print-optimized view of a PlanDocument.
 */
export function PrintablePlan({ doc }: PrintablePlanProps) {
  return (
    <article className="bg-white rounded-[16px] border border-[#E6DCD2] p-6 sm:p-8 space-y-8 print:border-0 print:p-0 print:rounded-none">
      <div className="border-b border-[#E6DCD2] pb-4 space-y-1.5">
        <h1 className="font-serif text-3xl font-bold text-[#2B1B2E] tracking-tight">
          {doc.title}
        </h1>
        <p className="text-sm text-[#5B4A5E]">{doc.subtitle}</p>
      </div>

      {doc.concept && (
        <section aria-labelledby="print-concept-heading" className="space-y-2">
          <h2
            id="print-concept-heading"
            className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
          >
            Selected concept
          </h2>
          <p className="text-base font-semibold text-[#2B1B2E]">
            {doc.concept.title} &mdash;{' '}
            <span className="font-normal text-[#5B4A5E]">
              {doc.concept.tagline}
            </span>
          </p>
          <p className="text-sm text-[#5B4A5E]">{doc.concept.summary}</p>
        </section>
      )}

      <PrintablePlanTables doc={doc} />

      <PrintablePlanDetails doc={doc} />

      <footer className="pt-4 border-t border-[#E6DCD2] text-xs text-[#5B4A5E] text-center">
        Prepared with Momently
      </footer>
    </article>
  );
}

export interface PrintablePlanClientProps {
  eventId?: string;
}

function resolvePrintEventId(
  propEventId: string | undefined,
  paramId: unknown,
): string {
  if (propEventId) return propEventId;
  return typeof paramId === 'string' ? paramId : '';
}

function triggerWindowPrint(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

export function PrintablePlanClient({
  eventId: propEventId,
}: PrintablePlanClientProps) {
  const params = useParams();
  const eventId = resolvePrintEventId(propEventId, params?.id);
  const hydrated = useEventsStore((s) => s.hydrated);
  const currentEvent = useOptionalCurrentEvent();
  const event = useEventsStore((s) => (eventId ? s.events[eventId] : undefined));
  const plan = event?.plan ?? currentEvent?.plan;
  const assumptions = event?.assumptions ?? [];

  if (!hydrated || !plan) {
    return (
      <div className="py-2 space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Printable plan"
          description="Clean, print-ready summary of your celebration plan."
        />
        <Skeleton className="h-96 w-full rounded-[16px]" />
      </div>
    );
  }

  const doc = buildPlanDocument(plan, engineContext.clock(), assumptions);

  return (
    <div className="py-2 space-y-6 max-w-4xl mx-auto">
      <div
        data-print-hide="true"
        className="no-print flex flex-wrap items-center justify-between gap-3"
      >
        <LinkButton
          href={`/events/${plan.id}/kit`}
          variant="secondary"
          className="min-h-[44px]"
        >
          Back to Event kit
        </LinkButton>

        <Button
          type="button"
          variant="primary"
          onClick={triggerWindowPrint}
          className="min-h-[44px]"
        >
          Print or save as PDF
        </Button>
      </div>

      <PrintablePlan doc={doc} />
    </div>
  );
}
