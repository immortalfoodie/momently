'use client';

import { useState } from 'react';
import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import { suggestSavings } from '@/engine/guardian';
import { previewOps } from '@/engine/preview';
import { formatInr } from '@/lib/format';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';

export interface UseUserEditResult {
  applyEdit: (
    ops: PlanPatchOp[],
    reason: string,
    editedFamily?: string,
  ) => Promise<boolean>;
  conflictOption: RecoveryOption | null;
  conflictDialogOpen: boolean;
  closeConflictDialog: () => void;
  handleApproveFunded: (option: RecoveryOption) => void;
}

function checkOverHardCap(
  plan: EventPlan,
  impact: { budgetTotalAfter: number; budgetCap: number | null },
): boolean {
  const hardCap = plan.constraints.find(
    (c) => c.kind === 'budget_cap' && c.severity === 'hard',
  );
  return (
    Boolean(hardCap) &&
    impact.budgetCap !== null &&
    impact.budgetTotalAfter > impact.budgetCap
  );
}

function createHardCapOption(
  plan: EventPlan,
  ops: PlanPatchOp[],
  reason: string,
  impact: { budgetTotalAfter: number; budgetCap: number | null },
  editedFamily?: string,
): RecoveryOption | null {
  const overBy = impact.budgetTotalAfter - (impact.budgetCap ?? 0);
  const baseOption = buildOption(
    plan,
    ops,
    {
      id: 'user_edit_over_cap',
      label: reason,
      tradeoff: `Proposed change exceeds hard budget cap by ${formatInr(overBy)}. Choose how to fund it or raise the cap.`,
    },
    engineContext,
    false,
    'user',
  );

  if (!baseOption) return null;

  const fundingOptions = suggestSavings(
    plan,
    overBy,
    { protectedFamilies: editedFamily ? [editedFamily] : [] },
    engineContext,
  );
  return {
    ...baseOption,
    fundingOptions,
    meetsCap: false,
  };
}

/**
 * useUserEdit hook providing safe, previewed user mutations against active plan budget items.
 * WHY: Enforces the single write path with automatic over-cap interception: saves safe edits directly
 * while routing hard cap violations into an approvable funding recovery dialog.
 */
export function useUserEdit(eventId: string): UseUserEditResult {
  const plan = useEventsStore((s) => s.events[eventId]?.plan);
  const storeApplyUserEdit = useEventsStore((s) => s.applyUserEdit);
  const { announce } = useAnnouncer();

  const [conflictOption, setConflictOption] = useState<RecoveryOption | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState<boolean>(false);

  const closeConflictDialog = () => {
    setConflictDialogOpen(false);
    setConflictOption(null);
  };

  const handleApproveFunded = (option: RecoveryOption) => {
    void option;
    closeConflictDialog();
  };

  const applyEdit = async (
    ops: PlanPatchOp[],
    reason: string,
    editedFamily?: string,
  ): Promise<boolean> => {
    if (!plan) return false;

    try {
      const preview = previewOps(plan, ops, engineContext);
      if (!preview.ok) {
        return false;
      }

      if (!checkOverHardCap(plan, preview.value.impact)) {
        const res = storeApplyUserEdit(eventId, ops, reason);
        if (res.ok) {
          announce(`Saved. Budget now ${formatInr(preview.value.impact.budgetTotalAfter)}.`);
          return true;
        }
        return false;
      }

      // Over hard cap: DO NOT save. Formulate funding recovery option.
      const optionWithFunding = createHardCapOption(
        plan,
        ops,
        reason,
        preview.value.impact,
        editedFamily,
      );
      if (optionWithFunding) {
        setConflictOption(optionWithFunding);
        setConflictDialogOpen(true);
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    applyEdit,
    conflictOption,
    conflictDialogOpen,
    closeConflictDialog,
    handleApproveFunded,
  };
}
