import type { EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { formatIsoDate } from '@/lib/format';

export interface EventFactsCardProps {
  plan: EventPlan;
  onEdit: () => void;
  className?: string;
}

/**
 * EventFactsCard renders a semantic definition list of core celebration facts.
 * WHY: Presents executive host parameters (date, headcount, city, setting) with collapsible notes.
 */
export function EventFactsCard({ plan, onEdit, className = '' }: EventFactsCardProps) {
  const { meta } = plan;

  return (
    <Card className={`p-5 bg-white border border-border space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="font-serif font-bold text-lg text-ink">Celebration Facts</h3>
          <p className="text-xs text-ink-muted mt-0.5">Core celebration details and host brief parameters.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          icon={<Icon name="sparkle" size={14} aria-hidden="true" />}
        >
          Edit details
        </Button>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
        <div>
          <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Title</dt>
          <dd className="font-medium text-ink mt-0.5">{meta.title}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Event Type</dt>
          <dd className="font-medium text-ink capitalize mt-0.5">
            {meta.type} <span className="text-xs text-ink-muted">(Fixed)</span>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">City</dt>
          <dd className="font-medium text-ink mt-0.5">{meta.city}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Date</dt>
          <dd className="font-medium text-ink mt-0.5">
            {meta.dateIso ? (
              <time dateTime={meta.dateIso}>{formatIsoDate(meta.dateIso)}</time>
            ) : (
              <span className="text-warning italic">Not scheduled yet</span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Guest Count</dt>
          <dd className="font-medium text-ink mt-0.5">{meta.guestCount} attending</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Setting</dt>
          <dd className="font-medium text-ink capitalize mt-0.5">{meta.setting}</dd>
        </div>
      </dl>

      {meta.hostBrief && (
        <details className="pt-2 text-xs text-ink-muted border-t border-surface-muted group">
          <summary className="cursor-pointer font-semibold text-primary hover:underline list-none flex items-center gap-1.5 py-1">
            <Icon name="sparkle" size={12} className="text-primary" aria-hidden="true" />
            <span>Your original description</span>
          </summary>
          <p className="mt-2 p-3 bg-surface-warm rounded-lg border border-border text-ink leading-relaxed">
            {meta.hostBrief}
          </p>
        </details>
      )}
    </Card>
  );
}
