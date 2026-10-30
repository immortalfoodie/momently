'use client';

import type { EventPlan } from '@/domain/types';
import { ConflictCard } from '@/components/review/ConflictCard';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { findConflicts } from '@/engine/conflicts';
import { engineContext } from '@/store/engineContext';

export interface AccessCheckProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

export function AccessCheck({ plan, eventId, className = '' }: AccessCheckProps) {
  const conflicts = findConflicts(plan, engineContext);
  const accessConflict = conflicts.find((c) => c.kind === 'access_unconfirmed');

  if (accessConflict) {
    return (
      <div className={`space-y-2 ${className}`}>
        <h3 className="text-sm font-semibold text-warning uppercase tracking-wider">
          Accessibility action required
        </h3>
        <ConflictCard conflict={accessConflict} eventId={eventId} plan={plan} />
      </div>
    );
  }

  return (
    <Card
      className={`p-4 bg-success-bg border border-success-border flex items-center gap-3 ${className}`}
    >
      <Icon name="check" size={20} className="text-success shrink-0" aria-hidden="true" />
      <p className="text-sm text-success font-medium">
        Venue accessibility confirmed. Step-free access routes and facilities are verified on your checklist.
      </p>
    </Card>
  );
}
