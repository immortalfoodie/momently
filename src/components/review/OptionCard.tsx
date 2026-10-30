'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { withFunding } from '@/engine/assistant/withFunding';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { SavingsPlan } from '@/engine/guardian';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { ImpactSummary } from './ImpactSummary';
import { ApprovalAlerts, ApprovalList, CapBadge, FundingChooser, capStatus } from './OptionCardParts';
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

function cardClass(isStale: boolean, className = ''): string {
  return `p-5 space-y-4 border-border bg-white ${isStale ? 'opacity-60 grayscale-[20%]' : ''} ${className}`;
}

interface OptionHeaderProps {
  option: RecoveryOption;
  isRecommended: boolean;
  isStale: boolean;
  isApproved: boolean;
}

function OptionHeader({ option, isRecommended, isStale, isApproved }: OptionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{option.label}</h3>
          {isRecommended && <Badge tone="brand">Recommended</Badge>}
          {isApproved && <Badge tone="success">Approved</Badge>}
          {isStale && !isApproved && <Badge tone="neutral">Out of date</Badge>}
        </div>
        <p className="text-xs text-ink-muted">{option.tradeoff}</p>
      </div>
      <CapBadge status={capStatus(option)} />
    </div>
  );
}

interface OptionActionsProps {
  canApprove: boolean;
  isPending: boolean;
  onApprove: () => void;
  onDismiss?: () => void;
}

function OptionActions({ canApprove, isPending, onApprove, onDismiss }: OptionActionsProps) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button variant="primary" onClick={onApprove} disabled={!canApprove || isPending}>
        Approve this change
      </Button>
      {onDismiss && (
        <Button variant="ghost" onClick={onDismiss} disabled={isPending}>
          Not now
        </Button>
      )}
    </div>
  );
}

/**
 * OptionCard presenting an engine recovery option with trade-offs, impact diffs, and funding choices.
 *
 * ACCESSIBILITY & APPROVAL DECISION (WHY):
 * Ensures explicit host consent ("You'd be approving:") before state application.
 * If over cap, prevents invalid mutations by disabling Approve with visible rationale,
 * offering interactive funding levers to restore budget feasibility.
 */
export function OptionCard({
  option: initialOption,
  eventId,
  plan: planProp,
  isRecommended,
  disabled,
  onApprove,
  onDismiss,
  className,
}: OptionCardProps) {
  const storePlan = useEventsStore((s) => (eventId ? s.events[eventId]?.plan : undefined));
  const activePlan = planProp ?? storePlan;

  const [activeOption, setActiveOption] = useState<RecoveryOption>(initialOption);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  const approveHook = useApproveOption(eventId ?? '');
  const isStale = Boolean(disabled) || approveHook.isStale;
  const status = capStatus(activeOption);
  const fundingOptions = initialOption.fundingOptions ?? [];

  const handleFundStrategy = (strategy: SavingsPlan) => {
    setSelectedStrategyId(strategy.id);
    if (!activePlan) return;
    const funded = withFunding(activePlan, initialOption, strategy, engineContext);
    if (funded.ok) setActiveOption(funded.value);
  };

  const handleApprove = () => {
    if (isStale || isApproved) return;
    const approved = eventId ? approveHook.approve(activeOption) : true;
    if (approved) {
      setIsApproved(true);
      onApprove?.(activeOption);
    }
  };

  return (
    <Card className={cardClass(isStale, className)}>
      <OptionHeader
        option={activeOption}
        isRecommended={Boolean(isRecommended)}
        isStale={isStale}
        isApproved={isApproved}
      />

      <ImpactSummary impact={activeOption.impact} />
      <ScoreDelta scoreBefore={activeOption.scoreBefore} scoreAfter={activeOption.scoreAfter} />

      {status.isOver && fundingOptions.length > 0 && (
        <FundingChooser strategies={fundingOptions} selectedId={selectedStrategyId} onSelect={handleFundStrategy} />
      )}

      <ApprovalList items={activeOption.approvalsRequired} />
      <ApprovalAlerts
        staleMessage={approveHook.staleMessage}
        hardViolation={approveHook.hardViolation}
        error={approveHook.error}
        isOver={status.isOver}
      />

      <OptionActions
        canApprove={!isStale && !isApproved && !status.isOver}
        isPending={approveHook.isPending}
        onApprove={handleApprove}
        onDismiss={onDismiss}
      />
    </Card>
  );
}
