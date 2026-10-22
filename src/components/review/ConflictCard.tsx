'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import type { Conflict, ResolutionOption } from '@/engine/conflicts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { OptionCard } from './OptionCard';

export interface ConflictCardProps {
  conflict: Conflict;
  eventId?: string;
  plan?: EventPlan;
  onAskToRelax?: (conflict: Conflict, resolution: ResolutionOption) => void;
  className?: string;
}

/**
 * Renders an active plan conflict with severity indicators and actionable resolution options.
 *
 * ACCESSIBILITY & INTERACTION DECISION (WHY):
 * Combines high-contrast badges with explicit icons ("Blocking" / "Warning").
 * Resolutions bearing patch operations preview through a modal OptionCard dialog,
 * while conversational options ("Tell me which to relax") delegate to host intent handlers.
 */
export function ConflictCard({
  conflict,
  eventId,
  plan: planProp,
  onAskToRelax,
  className = '',
}: ConflictCardProps) {
  const storePlan = useEventsStore((s) => (eventId ? s.events[eventId]?.plan : undefined));
  const activePlan = planProp ?? storePlan;

  const [previewOption, setPreviewOption] = useState<RecoveryOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleResolutionClick = (resolution: ResolutionOption) => {
    if (resolution.ops.length === 0) {
      onAskToRelax?.(conflict, resolution);
      return;
    }

    if (!activePlan) return;

    const opt = buildOption(
      activePlan,
      resolution.ops,
      {
        id: resolution.id,
        label: resolution.label,
        tradeoff: resolution.tradeoff,
      },
      engineContext,
    );

    if (opt) {
      setPreviewOption(opt);
      setDialogOpen(true);
    }
  };

  const isBlocking = conflict.severity === 'blocking';

  return (
    <Card className={`p-4 border-[#E6DCD2] bg-white space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge
          tone={isBlocking ? 'danger' : 'warning'}
          className="inline-flex items-center gap-1 font-semibold"
        >
          <Icon name="alert" size={14} aria-hidden="true" />
          <span>{isBlocking ? 'Blocking Conflict' : 'Plan Warning'}</span>
        </Badge>
      </div>

      <p className="text-sm text-[#2B1B2E]">{conflict.message}</p>

      {conflict.options.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {conflict.options.map((opt) => (
            <Button
              key={opt.id}
              variant="secondary"
              size="sm"
              onClick={() => handleResolutionClick(opt)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {previewOption && (
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={`Preview: ${previewOption.label}`}
        >
          <OptionCard
            option={previewOption}
            eventId={eventId}
            plan={activePlan}
            onApprove={() => setDialogOpen(false)}
            onDismiss={() => setDialogOpen(false)}
          />
        </Dialog>
      )}
    </Card>
  );
}
