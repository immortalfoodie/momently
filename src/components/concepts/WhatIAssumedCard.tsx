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

  // eslint-disable-next-line complexity
  const handleApplyField = (field: MissingInfoItem['field']) => {
    let ops: PlanPatchOp[] = [];
    let reason = '';

    if (field === 'guestCount' && typeof guestCountVal === 'number' && guestCountVal > 0) {
      ops = [{ type: 'set_meta', changes: { guestCount: guestCountVal } }];
      reason = `Set guest count to ${guestCountVal}`;
    } else if (field === 'city' && cityVal.trim().length > 0) {
      ops = [{ type: 'set_meta', changes: { city: cityVal.trim() } }];
      reason = `Set event city to ${cityVal.trim()}`;
    } else if (field === 'budget' && typeof budgetVal === 'number' && budgetVal > 0) {
      ops = [{ type: 'set_budget_cap', amount: budgetVal }];
      reason = `Set budget cap to ${formatInr(budgetVal)}`;
    } else if (field === 'date' && dateVal) {
      ops = [{ type: 'set_meta', changes: { dateIso: dateVal } }];
      reason = `Set event date to ${dateVal}`;
    }

    if (ops.length === 0) return;

    setEditConflict(null);
    setAppliedImpact(null);

    const res = applyUserEdit(eventId, ops, reason);
    if (res.ok) {
      setAppliedImpact(res.value);
    } else {
      if (res.error.code === 'hard_constraint_violation') {
        const impact = (res.error as { impact?: PlanImpact }).impact;
        const overTotal = impact?.budgetTotalAfter ?? 0;
        setEditConflict({
          id: `edit_conflict_${field}`,
          kind: 'cap_exceeded',
          severity: 'blocking',
          message: res.error.message,
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
        });
      }
    }
  };

  if (assumptions.length === 0 && missingInfo.length === 0 && !appliedImpact && !editConflict) {
    return null;
  }

  return (
    <Card className={`p-4 border-[#E6DCD2] bg-[#FAF5F0] space-y-4 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-[#2B1B2E]">What I assumed</h2>
        <p className="text-xs text-[#5C4556]">
          Based on your brief, Momently initialized these baseline parameters.
        </p>
      </div>

      {assumptions.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-[#5C4556] space-y-1">
          {assumptions.map((assumption, idx) => (
            <li key={idx}>{assumption}</li>
          ))}
        </ul>
      )}

      {missingInfo.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-[#E6DCD2]">
          <h3 className="text-xs font-semibold text-[#2B1B2E]">Missing Details to Confirm</h3>
          <div className="space-y-3">
            {missingInfo.map((item) => (
              <div key={item.field} className="p-3 bg-white rounded border border-[#E6DCD2] space-y-2">
                <p className="text-xs font-medium text-[#2B1B2E]">{item.question}</p>
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
                      className="w-44 text-xs rounded border border-[#E6DCD2] px-2.5 py-1.5 focus:border-[#6B2D5C] focus:ring-1 focus:ring-[#6B2D5C]"
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
        <div className="p-3 bg-white rounded border border-[#C3E6D7] space-y-2">
          <p className="text-xs font-semibold text-[#1F6F54]">Change applied successfully</p>
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
