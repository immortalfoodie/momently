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
        <h3 className="text-sm font-semibold text-[#8A5A00] uppercase tracking-wider">
          Accessibility action required
        </h3>
        <ConflictCard conflict={accessConflict} eventId={eventId} plan={plan} />
      </div>
    );
  }

  return (
    <Card
      className={`p-4 bg-[#E7F4EE] border border-[#C3E6D7] flex items-center gap-3 ${className}`}
    >
      <Icon name="check" size={20} className="text-[#1F6F54] shrink-0" aria-hidden="true" />
      <p className="text-sm text-[#1F6F54] font-medium">
        Venue accessibility confirmed. Step-free access routes and facilities are verified on your checklist.
      </p>
    </Card>
  );
}
