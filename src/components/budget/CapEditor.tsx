'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { getBudgetCap } from '@/engine/budget';
import { engineContext } from '@/store/engineContext';

export interface CapEditorProps {
  plan: EventPlan;
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CapEditor allowing hosts to adjust their financial ceiling and toggle between hard limits and flexible targets.
 * WHY: Dispatches pure change_budget intent directly to the engine without network round-trips.
 */
export function CapEditor({
  plan,
  eventId,
  isOpen,
  onClose,
}: CapEditorProps) {
  const currentCap = getBudgetCap(plan.constraints) ?? 150000;
  const currentConstraint = plan.constraints.find((c) => c.kind === 'budget_cap');
  const initialHard = currentConstraint?.severity === 'hard';

  const [amount, setAmount] = useState<number>(currentCap);
  const [isHard, setIsHard] = useState<boolean>(initialHard);
  const [outcome, setOutcome] = useState<AssistantOutcome | null>(null);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setAmount(currentCap);
      setIsHard(initialHard);
      setOutcome(null);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    const intent = {
      kind: 'change_budget' as const,
      amount: Math.max(0, Math.round(amount)),
      hard: isHard,
    };
    const res = resolveIntent(plan, intent, engineContext, today);
    setOutcome(res);
  };

  const handleApproved = () => {
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Adjust Budget Ceiling"
      description="Update your maximum spend limit and choose whether to enforce it as a hard barrier."
    >
      <div className="space-y-4 pt-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="cap-amount-input"
            label="Target Budget Cap (₹)"
            hint="Set your total celebration budget ceiling"
            required
          >
            <NumberInput
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1000}
              step={5000}
              required
              autoFocus
            />
          </Field>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FAF5F0] border border-[#E6DCD2]">
            <input
              id="cap-hard-toggle"
              type="checkbox"
              checked={isHard}
              onChange={(e) => setIsHard(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#E6DCD2] text-[#6B2D5C] focus:ring-[#1D4F91]"
            />
            <label htmlFor="cap-hard-toggle" className="text-sm font-medium text-[#2B1B2E]">
              Strict hard limit
              <span className="block text-xs font-normal text-[#5B4A5E] mt-0.5">
                When checked, Momently disables changes that exceed this cap and requires explicit funding tradeoffs.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Evaluate Change
            </Button>
          </div>
        </form>

        {outcome && (
          <div className="pt-3 border-t border-[#E6DCD2]">
            <AssistantOutcomeView
              outcome={outcome}
              eventId={eventId}
              currentVersion={plan.version}
              basedOnVersion={plan.version}
              onAskToRelax={handleApproved}
              className="pt-2"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
