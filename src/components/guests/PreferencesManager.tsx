'use client';

import { useMemo, useState } from 'react';
import type { Constraint, ConstraintKind, ConstraintSeverity, EventPlan, PlanPatchOp } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { ConflictList } from '@/components/review/ConflictList';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { findConflicts } from '@/engine/conflicts';
import { engineContext } from '@/store/engineContext';
import { AddPreferenceDialog } from './AddPreferenceDialog';

export interface PreferencesManagerProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

const KIND_LABELS: Record<string, string> = {
  must_have: 'Must have',
  avoid: 'Avoid',
  style: 'Style',
  dietary: 'Dietary',
  accessibility: 'Accessibility',
  venue: 'Venue',
};

export function PreferencesManager({ plan, eventId, className = '' }: PreferencesManagerProps) {
  const { announce } = useAnnouncer();
  const { applyEdit } = useUserEdit(eventId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingConstraint, setRemovingConstraint] = useState<Constraint | null>(null);

  const preferences = useMemo(() => {
    return plan.constraints.filter(
      (c) => c.kind !== 'budget_cap' && c.kind !== 'guest_count',
    );
  }, [plan.constraints]);

  const mustHaveConflicts = useMemo(() => {
    const all = findConflicts(plan, engineContext);
    return all.filter((c) => c.kind === 'must_have_missing');
  }, [plan]);

  const handleAddPreference = async (pref: {
    kind: ConstraintKind;
    description: string;
    severity: ConstraintSeverity;
  }) => {
    const newConstraint: Constraint = {
      id: engineContext.ids('constraint'),
      kind: pref.kind,
      description: pref.description,
      severity: pref.severity,
    };

    const op: PlanPatchOp = {
      type: 'add_constraint',
      constraint: newConstraint,
    };

    const ok = await applyEdit([op], `Added requirement: ${pref.description}`);
    if (ok) {
      announce(`Requirement "${pref.description}" added.`);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removingConstraint) return;

    const op: PlanPatchOp = {
      type: 'remove_constraint',
      id: removingConstraint.id,
    };

    const ok = await applyEdit([op], `Removed requirement: ${removingConstraint.description}`);
    if (ok) {
      announce(`Requirement "${removingConstraint.description}" removed.`);
    }
    setRemovingConstraint(null);
  };

  return (
    <Card className={`p-4 sm:p-6 bg-white border border-[#E6DCD2] space-y-6 ${className}`}>
      <div className="space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-[#2B1B2E]">
              Traditions and requirements
            </h3>
            <p className="text-sm text-[#5B4A5E]">
              Tell us about any traditions or religious requirements you want respected. We never assume any.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialogOpen(true)}
            className="min-h-[44px] shrink-0"
          >
            Add requirement
          </Button>
        </div>
        <p className="text-xs text-[#7A6B7E]">
          These notes may be processed by the AI to personalise ideas: please don&apos;t include names.
        </p>
      </div>

      {preferences.length === 0 ? (
        <div className="p-4 rounded-[12px] bg-[#F5F2EB] border border-[#E6DCD2] text-xs sm:text-sm text-[#5B4A5E]">
          No custom traditions or requirements recorded yet. Add must-have elements, dietary traditions, or layout rules above.
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Traditions and requirements list">
          {preferences.map((pref) => {
            const kindLabel = KIND_LABELS[pref.kind] ?? pref.kind;
            const isHard = pref.severity === 'hard';

            return (
              <div
                key={pref.id}
                role="listitem"
                className="p-3.5 sm:p-4 rounded-[12px] bg-[#FAF7F2] border border-[#E6DCD2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{kindLabel}</Badge>
                    <Badge tone={isHard ? 'danger' : 'info'}>
                      {isHard ? 'Must respect' : 'Nice to have'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-[#2B1B2E] break-words">
                    {pref.description}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemovingConstraint(pref)}
                  aria-label={`Remove requirement ${pref.description}`}
                  className="min-h-[44px] text-[#A82B35] self-start sm:self-center"
                >
                  <Icon name="close" size={16} className="mr-1.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Warnings relating to must-haves */}
      {mustHaveConflicts.length > 0 && (
        <div className="pt-4 border-t border-[#E6DCD2] space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A5A00]">
            Must-have budget warnings
          </h4>
          <ConflictList eventId={eventId} conflicts={mustHaveConflicts} />
        </div>
      )}

      <AddPreferenceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleAddPreference}
      />

      {/* Confirm remove modal */}
      {removingConstraint && (
        <Dialog
          open={Boolean(removingConstraint)}
          onClose={() => setRemovingConstraint(null)}
          title="Remove requirement?"
        >
          <div className="space-y-4">
            <p className="text-sm text-[#5B4A5E]">
              Are you sure you want to remove &ldquo;{removingConstraint.description}&rdquo; from your plan?
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setRemovingConstraint(null)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmRemove}
                className="min-h-[44px]"
              >
                Remove
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}
