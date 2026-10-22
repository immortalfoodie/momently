'use client';

import type { Conflict, ResolutionOption } from '@/engine/conflicts';
import { useEventDerived } from '@/store/selectors';
import { ConflictCard } from './ConflictCard';

export interface ConflictListProps {
  eventId: string;
  onAskToRelax?: (conflict: Conflict, resolution: ResolutionOption) => void;
  className?: string;
}

/**
 * Lists all active conflicts derived deterministically from the current plan version.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Renders an accessible list landmark with unique ConflictCard items, exposing
 * clear non-visual statuses when zero conflicts remain.
 */
export function ConflictList({ eventId, onAskToRelax, className = '' }: ConflictListProps) {
  const derived = useEventDerived(eventId);
  const conflicts = derived?.findConflicts ?? [];

  if (conflicts.length === 0) {
    return (
      <div className={`p-4 rounded-lg bg-[#E7F4EE] border border-[#C3E6D7] text-xs text-[#1F6F54] ${className}`}>
        No active conflicts detected. Your celebration plan is internally consistent and feasible.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} role="region" aria-label="Active conflicts">
      {conflicts.map((conflict) => (
        <ConflictCard
          key={conflict.id}
          conflict={conflict}
          eventId={eventId}
          onAskToRelax={onAskToRelax}
        />
      ))}
    </div>
  );
}
