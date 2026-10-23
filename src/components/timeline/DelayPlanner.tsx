'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { OptionCard } from '@/components/review/OptionCard';
import { buildDelayOptions } from '@/engine/delayOptions';
import type { RecoveryOption } from '@/engine/chaos/types';
import { formatMinuteOfDay } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { engineContext } from '@/store/engineContext';

export interface DelayPlannerProps {
  plan: EventPlan;
  eventId?: string;
  className?: string;
}

const DELAY_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

function isInfeasibleOption(option: RecoveryOption): boolean {
  return option.notes.some((n) => n.toLowerCase().includes('infeasible'));
}

function checkAllInfeasible(options: RecoveryOption[] | null): boolean {
  if (!options || options.length === 0) return false;
  return options.every(isInfeasibleOption);
}

function getRecommendedIndex(options: RecoveryOption[] | null): number {
  if (!options || options.length === 0) return -1;
  const feasibleIndex = options.findIndex((o) => !isInfeasibleOption(o));
  return feasibleIndex !== -1 ? feasibleIndex : 0;
}

export function DelayPlanner({ plan, eventId, className = '' }: DelayPlannerProps) {
  const targetEventId = eventId ?? plan.id;
  const sortedSlots = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);
  const defaultAnchorId = sortedSlots[0]?.id ?? '';

  const [anchorSlotId, setAnchorSlotId] = useState<string>(defaultAnchorId);
  const [delayMinutes, setDelayMinutes] = useState<number>(60);
  const [options, setOptions] = useState<RecoveryOption[] | null>(null);

  const handleShowOptions = () => {
    const targetAnchor = anchorSlotId || defaultAnchorId;
    if (!anchorSlotId && targetAnchor) {
      setAnchorSlotId(targetAnchor);
    }
    const res = buildDelayOptions(
      plan,
      { anchorSlotId: targetAnchor, delayMinutes },
      engineContext,
    );
    setOptions(res);
  };

  const allInfeasible = checkAllInfeasible(options);
  const recommendedIndex = getRecommendedIndex(options);

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="space-y-1">
        <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">Something running late?</h3>
        <p className="text-xs text-[#5B4A5E]">
          Momently suggests; you decide. It never contacts vendors or guests: you do that yourself.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Which activity is late or delayed?">
          <Select
            value={anchorSlotId || defaultAnchorId}
            onChange={(e) => setAnchorSlotId(e.target.value)}
            aria-label="Which activity is late or delayed?"
          >
            {sortedSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.title} ({formatMinuteOfDay(slot.startMinute)})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Delay length">
          <Select
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value))}
            aria-label="Delay duration in minutes"
          >
            {DELAY_MINUTES_OPTIONS.map((mins) => (
              <option key={mins} value={mins}>
                {mins} minutes
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end pt-2 border-t border-[#E6DCD2]">
        <Button variant="primary" onClick={handleShowOptions}>
          Show my options
        </Button>
      </div>

      {allInfeasible && (
        <Alert tone="warning" title="Timeline overflow detected">
          Every recovery strategy causes a schedule overrun for a {delayMinutes}-minute delay. Review the overflow numbers below to determine necessary session adjustments.
        </Alert>
      )}

      {options && options.length > 0 && (
        <div className="space-y-4 pt-3 border-t border-[#E6DCD2]">
          <h4 className="text-sm font-semibold text-[#2B1B2E]">
            Suggested Recovery Strategies ({options.length})
          </h4>
          <div className="space-y-4">
            {options.map((opt, idx) => (
              <OptionCard
                key={opt.id}
                option={opt}
                eventId={targetEventId}
                plan={plan}
                isRecommended={idx === recommendedIndex}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
