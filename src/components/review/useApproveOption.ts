'use client';

import { useCallback, useState } from 'react';
import type { PlanImpact, PlanPatch } from '@/domain/types';
import type { RecoveryOption } from '@/engine/chaos/types';
import { formatInr } from '@/lib/format';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { useEventsStore } from '@/store/eventsStore';

export interface HardViolationDetails {
  message: string;
  overBy?: number;
}

export interface UseApproveOptionResult {
  approve: (optionOrPatch: RecoveryOption | PlanPatch) => boolean;
  isPending: boolean;
  isStale: boolean;
  staleMessage: string | null;
  hardViolation: HardViolationDetails | null;
  error: string | null;
  resetErrors: () => void;
}

/**
 * Hook providing a resilient, accessible execution pipeline for host option approvals.
 *
 * ACCESSIBILITY & DATA-FLOW DECISION (WHY):
 * Reads active plan version at render time and supplies `basedOnVersion` to guarantee staleness
 * protection. Emits assertive screen-reader announcements upon success, gracefully isolates
 * hard constraint violations without throwing, and surfaces plain-language conflict messages.
 */
export function useApproveOption(eventId: string): UseApproveOptionResult {
  const { announce } = useAnnouncer();
  const event = useEventsStore((s) => s.events[eventId]);
  const approveAndApply = useEventsStore((s) => s.approveAndApply);

  const currentVersion = event?.plan.version ?? 0;

  const [isPending, setIsPending] = useState(false);
  const [staleMessage, setStaleMessage] = useState<string | null>(null);
  const [hardViolation, setHardViolation] = useState<HardViolationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetErrors = useCallback(() => {
    setStaleMessage(null);
    setHardViolation(null);
    setError(null);
  }, []);

  const approve = useCallback(
    (optionOrPatch: RecoveryOption | PlanPatch): boolean => {
      resetErrors();
      setIsPending(true);

      try {
        const patch = 'patch' in optionOrPatch ? optionOrPatch.patch : optionOrPatch;
        const res = approveAndApply(eventId, patch, {
          basedOnVersion: currentVersion,
          recordSnapshot: true,
        });

        setIsPending(false);

        if (res.ok) {
          const budgetFormatted = formatInr(res.value.budgetTotalAfter);
          const nextVersion = currentVersion + 1;
          announce(`Change applied. Budget now ${budgetFormatted}. Plan version ${nextVersion}.`);
          return true;
        }

        const errCode = res.error.code;
        if (errCode === 'stale_plan') {
          setStaleMessage('The plan changed since this suggestion was made. Please ask again.');
        } else if (errCode === 'hard_constraint_violation') {
          const impact = (res.error as { impact?: PlanImpact }).impact;
          const overBy =
            impact && impact.budgetCap !== null
              ? Math.max(0, impact.budgetTotalAfter - impact.budgetCap)
              : undefined;

          setHardViolation({
            message: res.error.message,
            overBy,
          });
        } else {
          setError(res.error.message);
        }

        return false;
      } catch {
        setIsPending(false);
        setError('An unexpected error occurred while applying this change.');
        return false;
      }
    },
    [eventId, currentVersion, approveAndApply, announce, resetErrors],
  );

  return {
    approve,
    isPending,
    isStale: Boolean(staleMessage),
    staleMessage,
    hardViolation,
    error,
    resetErrors,
  };
}
