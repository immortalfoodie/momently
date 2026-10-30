'use client';

import { useId } from 'react';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { SavingsPlan } from '@/engine/guardian';
import type { ExperienceImpact } from '@/engine/levers';
import { formatInr } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Money } from '@/components/ui/Money';

/** Whether an option breaks the budget cap, and by how much. */
export interface CapStatus {
  isOver: boolean;
  overBy: number;
}

/**
 * Derives cap status from an option's impact.
 * WHY: One definition of "over the cap" shared by the badge, the warning and the Approve button.
 *
 * @param option - Recovery option to evaluate.
 * @returns Whether it exceeds the cap and the overage in rupees.
 */
export function capStatus(option: RecoveryOption): CapStatus {
  const { budgetCap, budgetTotalAfter, overCap } = option.impact;
  const exceeds = budgetCap !== null && budgetTotalAfter > budgetCap;
  return {
    isOver: !option.meetsCap || overCap || exceeds,
    overBy: budgetCap !== null ? Math.max(0, budgetTotalAfter - budgetCap) : 0,
  };
}

function impactTone(impact: ExperienceImpact): BadgeTone {
  if (impact === 'high') return 'danger';
  if (impact === 'medium') return 'warning';
  return 'neutral';
}

/** Cap badge pairing an icon with words so status never relies on colour alone. */
export function CapBadge({ status }: { status: CapStatus }) {
  return status.isOver ? (
    <Badge tone="danger" className="inline-flex items-center gap-1">
      <Icon name="alert" size={12} aria-hidden="true" />
      <span>Goes over your cap by {formatInr(status.overBy)}</span>
    </Badge>
  ) : (
    <Badge tone="success" className="inline-flex items-center gap-1">
      <Icon name="check" size={12} aria-hidden="true" />
      <span>Meets your budget cap</span>
    </Badge>
  );
}

export interface FundingChooserProps {
  strategies: SavingsPlan[];
  selectedId: string | null;
  onSelect: (strategy: SavingsPlan) => void;
}

/** Radio group of savings strategies that can pay for an over-cap option. */
export function FundingChooser({ strategies, selectedId, onSelect }: FundingChooserProps) {
  const groupName = useId();
  return (
    <fieldset className="p-3.5 rounded-lg border border-warning-border bg-[#FFFBF0] space-y-2.5">
      <legend className="text-xs font-semibold text-warning px-1">Choose how to fund it</legend>
      <div className="space-y-2">
        {strategies.map((strategy) => (
          <label
            key={strategy.id}
            className="flex flex-col p-2.5 rounded border border-border bg-white cursor-pointer hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={groupName}
                  value={strategy.id}
                  checked={selectedId === strategy.id}
                  onChange={() => onSelect(strategy)}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-ink">{strategy.label}</span>
              </div>
              <span className="text-xs font-semibold text-success">
                Saves <Money amount={strategy.achieved} />
              </span>
            </div>
            {strategy.levers.length > 0 && (
              <div className="mt-2 pl-6 space-y-1">
                {strategy.levers.map((lever) => (
                  <div key={lever.id} className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{lever.label}</span>
                    <div className="flex items-center gap-2">
                      <span>
                        -<Money amount={lever.savings} />
                      </span>
                      <Badge tone={impactTone(lever.experienceImpact)}>{lever.experienceImpact} impact</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The explicit consent list shown before approval. */
export function ApprovalList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold text-ink">You&apos;d be approving:</p>
      <ul className="list-disc pl-5 text-ink-muted space-y-0.5">
        {items.map((req, i) => (
          <li key={i}>{req}</li>
        ))}
      </ul>
    </div>
  );
}

export interface ApprovalAlertsProps {
  staleMessage: string | null;
  hardViolation: { message: string; overBy?: number } | null;
  isOver: boolean;
}

/** Explains why an option cannot be approved: stale, rejected by the engine, or over the cap. */
export function ApprovalAlerts({ staleMessage, hardViolation, isOver }: ApprovalAlertsProps) {
  return (
    <>
      {staleMessage && (
        <Alert tone="warning" title="Suggestion Expired">
          {staleMessage}
        </Alert>
      )}
      {hardViolation && (
        <Alert tone="danger" title="Cannot Apply Change">
          {hardViolation.message}
          {hardViolation.overBy !== undefined && (
            <span className="block mt-1 font-semibold">
              Exceeds hard budget cap by {formatInr(hardViolation.overBy)}.
            </span>
          )}
        </Alert>
      )}
      {isOver && (
        <div className="p-2.5 rounded bg-danger-bg border border-danger-border text-xs text-danger space-y-0.5">
          <p className="font-semibold">Cannot approve: Budget cap exceeded.</p>
          <p>
            The engine rejects changes violating hard budget caps. Choose a funding strategy above, or raise your
            budget cap in the plan conflicts.
          </p>
        </div>
      )}
    </>
  );
}
