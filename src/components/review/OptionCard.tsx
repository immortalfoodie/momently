'use client';

import { useId, useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { withFunding } from '@/engine/assistant/withFunding';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { SavingsPlan } from '@/engine/guardian';
import type { ExperienceImpact } from '@/engine/levers';
import { formatInr } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Money } from '@/components/ui/Money';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { ImpactSummary } from './ImpactSummary';
import { ScoreDelta } from './ScoreDelta';
import { useApproveOption } from './useApproveOption';

export interface OptionCardProps {
  option: RecoveryOption;
  eventId?: string;
  plan?: EventPlan;
  isRecommended?: boolean;
  disabled?: boolean;
  onApprove?: (option: RecoveryOption) => void;
  onDismiss?: () => void;
  className?: string;
}

function getImpactBadgeTone(impact: ExperienceImpact): BadgeTone {
  if (impact === 'high') return 'danger';
  if (impact === 'medium') return 'warning';
  return 'neutral';
}

/**
 * OptionCard presenting an engine recovery option with trade-offs, impact diffs, and funding choices.
 *
 * ACCESSIBILITY & APPROVAL DECISION (WHY):
 * Ensures explicit host consent ("You'd be approving:") before state application.
 * If over cap, prevents invalid mutations by disabling Approve with visible rationale,
 * offering interactive funding levers to restore budget feasibility.
 */
// eslint-disable-next-line complexity
export function OptionCard({
  option: initialOption,
  eventId,
  plan: planProp,
  isRecommended = false,
  disabled = false,
  onApprove,
  onDismiss,
  className = '',
}: OptionCardProps) {
  const storePlan = useEventsStore((s) => (eventId ? s.events[eventId]?.plan : undefined));
  const activePlan = planProp ?? storePlan;
  const fundingRadioGroupId = useId();

  const [activeOption, setActiveOption] = useState<RecoveryOption>(initialOption);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const approveHook = useApproveOption(eventId ?? '');
  const isStale = disabled || approveHook.isStale;

  const handleFundStrategy = (strategy: SavingsPlan) => {
    setSelectedStrategyId(strategy.id);
    if (!activePlan) return;
    const funded = withFunding(activePlan, initialOption, strategy, engineContext);
    if (funded.ok) {
      setActiveOption(funded.value);
    }
  };

  const handleApprove = () => {
    if (isStale) return;
    if (eventId) {
      const ok = approveHook.approve(activeOption);
      if (ok && onApprove) onApprove(activeOption);
    } else if (onApprove) {
      onApprove(activeOption);
    }
  };

  const budgetCap = activeOption.impact.budgetCap;
  const isOver = !activeOption.meetsCap || activeOption.impact.overCap ||
    (budgetCap !== null && activeOption.impact.budgetTotalAfter > budgetCap);
  const overBy = budgetCap !== null ? Math.max(0, activeOption.impact.budgetTotalAfter - budgetCap) : 0;

  return (
    <Card className={`p-5 space-y-4 border-[#E6DCD2] bg-white ${isStale ? 'opacity-60 grayscale-[20%]' : ''} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#2B1B2E]">{activeOption.label}</h3>
            {isRecommended && <Badge tone="brand">Recommended</Badge>}
            {isStale && <Badge tone="neutral">Out of date</Badge>}
          </div>
          <p className="text-xs text-[#5C4556]">{activeOption.tradeoff}</p>
        </div>

        <div>
          {isOver ? (
            <Badge tone="danger" className="inline-flex items-center gap-1">
              <Icon name="alert" size={12} aria-hidden="true" />
              <span>Goes over your cap by {formatInr(overBy)}</span>
            </Badge>
          ) : (
            <Badge tone="success" className="inline-flex items-center gap-1">
              <Icon name="check" size={12} aria-hidden="true" />
              <span>Meets your budget cap</span>
            </Badge>
          )}
        </div>
      </div>

      <ImpactSummary impact={activeOption.impact} />

      {activeOption.scoreBefore !== undefined && activeOption.scoreAfter !== undefined && (
        <ScoreDelta scoreBefore={activeOption.scoreBefore} scoreAfter={activeOption.scoreAfter} />
      )}

      {initialOption.fundingOptions && initialOption.fundingOptions.length > 0 && isOver && (
        <fieldset className="p-3.5 rounded-lg border border-[#FFE2A8] bg-[#FFFBF0] space-y-2.5">
          <legend className="text-xs font-semibold text-[#8A5A00] px-1">Choose how to fund it</legend>
          <div className="space-y-2">
            {initialOption.fundingOptions.map((strategy) => (
              <label
                key={strategy.id}
                className="flex flex-col p-2.5 rounded border border-[#E6DCD2] bg-white cursor-pointer hover:border-[#6B2D5C] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={fundingRadioGroupId}
                      value={strategy.id}
                      checked={selectedStrategyId === strategy.id}
                      onChange={() => handleFundStrategy(strategy)}
                      className="text-[#6B2D5C] focus:ring-[#6B2D5C]"
                    />
                    <span className="text-xs font-medium text-[#2B1B2E]">{strategy.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#1F6F54]">
                    Saves <Money amount={strategy.achieved} />
                  </span>
                </div>
                {strategy.levers.length > 0 && (
                  <div className="mt-2 pl-6 space-y-1">
                    {strategy.levers.map((lever) => (
                      <div key={lever.id} className="flex items-center justify-between text-xs text-[#5C4556]">
                        <span>{lever.label}</span>
                        <div className="flex items-center gap-2">
                          <span>-<Money amount={lever.savings} /></span>
                          <Badge tone={getImpactBadgeTone(lever.experienceImpact)}>
                            {lever.experienceImpact} impact
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {activeOption.approvalsRequired.length > 0 && (
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-[#2B1B2E]">You&apos;d be approving:</p>
          <ul className="list-disc pl-5 text-[#5C4556] space-y-0.5">
            {activeOption.approvalsRequired.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {approveHook.staleMessage && (
        <Alert tone="warning" title="Suggestion Expired">
          {approveHook.staleMessage}
        </Alert>
      )}

      {approveHook.hardViolation && (
        <Alert tone="danger" title="Cannot Apply Change">
          {approveHook.hardViolation.message}
          {approveHook.hardViolation.overBy !== undefined && (
            <span className="block mt-1 font-semibold">
              Exceeds hard budget cap by {formatInr(approveHook.hardViolation.overBy)}.
            </span>
          )}
        </Alert>
      )}

      {isOver && (
        <div className="p-2.5 rounded bg-[#FBE9EB] border border-[#F4C5CB] text-xs text-[#A12B3A] space-y-0.5">
          <p className="font-semibold">Cannot approve: Budget cap exceeded.</p>
          <p>
            The engine rejects changes violating hard budget caps. Choose a funding strategy above,
            or raise your budget cap in the plan conflicts.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="primary"
          onClick={handleApprove}
          disabled={isStale || isOver || approveHook.isPending}
        >
          Approve this change
        </Button>
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss} disabled={approveHook.isPending}>
            Not now
          </Button>
        )}
      </div>
    </Card>
  );
}
