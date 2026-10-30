'use client';

import type { EventPlan, PlanImpact } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { ImpactSummary } from '@/components/review/ImpactSummary';
import { Dialog } from '@/components/ui/Dialog';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { PAGE_COPY } from '@/lib/copy';

export function OverviewSkeleton() {
  return (
    <PageContainer width="full" className="space-y-6">
      <PageHeader
        title={PAGE_COPY.overview.title}
        description={PAGE_COPY.overview.description}
      />
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}

export function OverviewNav() {
  return (
    <nav aria-label="Overview sections" className="sticky top-0 z-10 bg-surface-warm/95 backdrop-blur-xs py-2 border-b border-border">
      <ul className="flex items-center gap-4 text-xs font-semibold text-ink-muted overflow-x-auto">
        <li><a href="#facts" className="hover:text-primary hover:underline whitespace-nowrap">Facts</a></li>
        <li><a href="#concept" className="hover:text-primary hover:underline whitespace-nowrap">Concept</a></li>
        <li><a href="#conflicts" className="hover:text-primary hover:underline whitespace-nowrap">Conflicts</a></li>
        <li><a href="#risks" className="hover:text-primary hover:underline whitespace-nowrap">Risks</a></li>
        <li><a href="#next-steps" className="hover:text-primary hover:underline whitespace-nowrap">Next Steps</a></li>
        <li><a href="#history" className="hover:text-primary hover:underline whitespace-nowrap">History</a></li>
      </ul>
    </nav>
  );
}

interface RepriceImpactDialogProps {
  impact: PlanImpact | null;
  onClose: () => void;
}

export function RepriceImpactDialog({ impact, onClose }: RepriceImpactDialogProps) {
  return (
    <Dialog
      open={Boolean(impact)}
      onClose={onClose}
      title="Prices Re-estimated for City Rate Tier"
      description="Estimate items in your budget have been repriced based on your updated host city's vendor tier."
    >
      {impact && (
        <div className="pt-2 space-y-4">
          <ImpactSummary impact={impact} />
          <div className="flex justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#5B254E]"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

interface ComplexOutcomeDialogProps {
  outcome: AssistantOutcome | null;
  eventId: string;
  plan: EventPlan;
  onClose: () => void;
}

export function ComplexOutcomeDialog({ outcome, eventId, plan, onClose }: ComplexOutcomeDialogProps) {
  return (
    <Dialog
      open={Boolean(outcome)}
      onClose={onClose}
      title="Proposed Parameter Adjustment"
      description="Headcount or setting adjustments require approval to evaluate resource constraints."
    >
      {outcome && (
        <div className="pt-2">
          <AssistantOutcomeView
            outcome={outcome}
            eventId={eventId}
            plan={plan}
            currentVersion={plan.version}
            onApprove={() => onClose()}
            onDismiss={onClose}
          />
        </div>
      )}
    </Dialog>
  );
}
