import type { AssistantStepSummary } from '@/engine/assistant/types';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

const STATUS_COPY: Record<AssistantStepSummary['status'], { label: string; tone: BadgeTone }> = {
  planned: { label: 'In proposal', tone: 'brand' },
  checked: { label: 'Checked', tone: 'info' },
  skipped: { label: 'Not done', tone: 'warning' },
};

export interface StepListProps {
  steps: AssistantStepSummary[];
}

/**
 * Ordered "What I'll do" list for compound chat requests.
 * ACCESSIBILITY (WHY): A native ordered list conveys sequence to screen readers, and every status
 * is a text badge so meaning never depends on colour alone.
 */
export function StepList({ steps }: StepListProps) {
  return (
    <section aria-label="What I'll do" className="rounded-lg border border-[#E6DCD2] bg-[#FAF5F0] p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5B4A5E] mb-2">What I&apos;ll do</h3>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-[#2B1B2E]">
        {steps.map((step, idx) => (
          <li key={`${idx}-${step.label}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{step.label}</span>
              <Badge tone={STATUS_COPY[step.status].tone}>{STATUS_COPY[step.status].label}</Badge>
            </div>
            <p className="text-xs text-[#5C4556] mt-0.5">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
