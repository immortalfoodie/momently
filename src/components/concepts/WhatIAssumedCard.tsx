'use client';

import { useState } from 'react';
import type { PlanImpact, PlanPatchOp } from '@/domain/types';
import type { Conflict, ResolutionOption } from '@/engine/conflicts';
import { formatInr } from '@/lib/format';
import type { MissingInfoItem } from '@/llm/schemas/intake';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NumberInput } from '@/components/ui/NumberInput';
import { TextInput } from '@/components/ui/TextInput';
import { ConflictCard } from '@/components/review/ConflictCard';
import { ImpactSummary } from '@/components/review/ImpactSummary';
import { useEventsStore } from '@/store/eventsStore';

export interface WhatIAssumedCardProps {
  eventId: string;
  assumptions: string[];
  missingInfo: MissingInfoItem[];
  onAskToRelax?: (conflict: Conflict, resolution: ResolutionOption) => void;
  className?: string;
}

interface FieldValues {
  guestCountVal: number | '';
  cityVal: string;
  budgetVal: number | '';
  dateVal: string;
}

interface FieldEdit {
  ops: PlanPatchOp[];
  reason: string;
}

function isPositive(value: number | ''): value is number {
  return typeof value === 'number' && value > 0;
}

const FIELD_EDITS: Partial<Record<MissingInfoItem['field'], (v: FieldValues) => FieldEdit | null>> = {
  guestCount: ({ guestCountVal }) =>
    isPositive(guestCountVal)
      ? {
          ops: [{ type: 'set_meta', changes: { guestCount: guestCountVal } }],
          reason: `Set guest count to ${guestCountVal}`,
        }
      : null,
  city: ({ cityVal }) => {
    const city = cityVal.trim();
    return city.length > 0
      ? { ops: [{ type: 'set_meta', changes: { city } }], reason: `Set event city to ${city}` }
      : null;
  },
  budget: ({ budgetVal }) =>
    isPositive(budgetVal)
      ? {
          ops: [{ type: 'set_budget_cap', amount: budgetVal }],
          reason: `Set budget cap to ${formatInr(budgetVal)}`,
        }
      : null,
  date: ({ dateVal }) =>
    dateVal
      ? { ops: [{ type: 'set_meta', changes: { dateIso: dateVal } }], reason: `Set event date to ${dateVal}` }
      : null,
};

function buildFieldEdit(field: MissingInfoItem['field'], values: FieldValues): FieldEdit | null {
  const build = FIELD_EDITS[field];
  return build ? build(values) : null;
}

function buildCapConflict(field: string, message: string, impact: PlanImpact | undefined): Conflict {
  const overTotal = impact?.budgetTotalAfter ?? 0;
  return {
    id: `edit_conflict_${field}`,
    kind: 'cap_exceeded',
    severity: 'blocking',
    message,
    options: [
      {
        id: `raise_cap_${field}`,
        label: `Raise budget cap to ${formatInr(overTotal)}`,
        tradeoff: 'Higher budget cap',
        ops: [{ type: 'set_budget_cap', amount: overTotal }],
      },
      {
        id: `relax_items_${field}`,
        label: 'Tell me which to relax',
        tradeoff: 'Keep current budget cap and adjust line items',
        ops: [],
      },
    ],
  };
}

/**
 * Displays initial assumptions and provides quick-edit resolution for missing plan details.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Dismissible-free persistent landmark avoiding fleeting toasts. Missing details provide
 * standard form controls with explicit labels and error states routed to ConflictCards.
 */
export function WhatIAssumedCard({
  eventId,
  assumptions,
  missingInfo,
  onAskToRelax,
  className = '',
}: WhatIAssumedCardProps) {
  const applyUserEdit = useEventsStore((s) => s.applyUserEdit);

  const [guestCountVal, setGuestCountVal] = useState<number | ''>('');
  const [cityVal, setCityVal] = useState<string>('');
  const [budgetVal, setBudgetVal] = useState<number | ''>('');
  const [dateVal, setDateVal] = useState<string>('');

  const [appliedImpact, setAppliedImpact] = useState<PlanImpact | null>(null);
  const [editConflict, setEditConflict] = useState<Conflict | null>(null);

  const handleApplyField = (field: MissingInfoItem['field']) => {
    const edit = buildFieldEdit(field, { guestCountVal, cityVal, budgetVal, dateVal });
    if (!edit) return;

    setEditConflict(null);
    setAppliedImpact(null);

    const res = applyUserEdit(eventId, edit.ops, edit.reason);
    if (res.ok) {
      setAppliedImpact(res.value);
    } else if (res.error.code === 'hard_constraint_violation') {
      const impact = (res.error as { impact?: PlanImpact }).impact;
      setEditConflict(buildCapConflict(field, res.error.message, impact));
    }
  };

  if (assumptions.length === 0 && missingInfo.length === 0 && !appliedImpact && !editConflict) {
    return null;
  }

  return (
    <Card className={`p-4 border-border bg-surface-warm space-y-4 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-ink">What I assumed</h2>
        <p className="text-xs text-ink-muted">
          Based on your brief, Momently initialized these baseline parameters.
        </p>
      </div>

      {assumptions.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-ink-muted space-y-1">
          {assumptions.map((assumption, idx) => (
            <li key={idx}>{assumption}</li>
          ))}
        </ul>
      )}

      {missingInfo.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border">
          <h3 className="text-xs font-semibold text-ink">Missing Details to Confirm</h3>
          <div className="space-y-3">
            {missingInfo.map((item) => (
              <div key={item.field} className="p-3 bg-white rounded border border-border space-y-2">
                <p className="text-xs font-medium text-ink">{item.question}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.field === 'guestCount' && (
                    <NumberInput
                      value={guestCountVal}
                      onChange={(e) =>
                        setGuestCountVal(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="e.g. 80"
                      min={1}
                      className="w-36 text-xs"
                      aria-label="Confirm guest count"
                    />
                  )}
                  {item.field === 'city' && (
                    <TextInput
                      value={cityVal}
                      onChange={(e) => setCityVal(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-44 text-xs"
                      aria-label="Confirm event city"
                    />
                  )}
                  {item.field === 'budget' && (
                    <NumberInput
                      value={budgetVal}
                      onChange={(e) =>
                        setBudgetVal(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="e.g. 150000"
                      min={1000}
                      step={5000}
                      className="w-36 text-xs"
                      aria-label="Confirm budget cap"
                    />
                  )}
                  {item.field === 'date' && (
                    <input
                      type="date"
                      value={dateVal}
                      onChange={(e) => setDateVal(e.target.value)}
                      className="w-44 text-xs rounded border border-border px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary"
                      aria-label="Confirm celebration date"
                    />
                  )}
                  <Button size="sm" variant="secondary" onClick={() => handleApplyField(item.field)}>
                    Apply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {appliedImpact && (
        <div className="p-3 bg-white rounded border border-success-border space-y-2">
          <p className="text-xs font-semibold text-success">Change applied successfully</p>
          <ImpactSummary impact={appliedImpact} />
        </div>
      )}

      {editConflict && (
        <div className="space-y-2 pt-2">
          <ConflictCard
            conflict={editConflict}
            eventId={eventId}
            onAskToRelax={onAskToRelax}
          />
        </div>
      )}
    </Card>
  );
}
