'use client';

import Link from 'next/link';
import type { EventPlan } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import type { Conflict, ResolutionOption } from '@/engine/conflicts';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { useEventsStore } from '@/store/eventsStore';
import { ConflictCard } from './ConflictCard';
import { OptionCard } from './OptionCard';

export interface AssistantOutcomeViewProps {
  outcome: AssistantOutcome;
  eventId?: string;
  plan?: EventPlan;
  currentVersion?: number;
  basedOnVersion?: number;
  narration?: { text: string; highlights?: string[] } | string;
  onAskToRelax?: (conflict: Conflict, resolution: ResolutionOption) => void;
  className?: string;
}

/**
 * Renders any variant of AssistantOutcome with strict type safety, visual dimming when stale,
 * and seamless delegation to specialized review primitives.
 *
 * ACCESSIBILITY & DATA-FLOW DECISION (WHY):
 * Stale outcomes (based on superseded plan revisions) are dimmed and marked with an "Out of date"
 * badge with approve controls disabled to guarantee host safety.
 */
// eslint-disable-next-line complexity
export function AssistantOutcomeView({
  outcome,
  eventId,
  plan: planProp,
  currentVersion: currentVersionProp,
  basedOnVersion: basedOnVersionProp,
  narration: narrationProp,
  onAskToRelax,
  className = '',
}: AssistantOutcomeViewProps) {
  const storePlan = useEventsStore((s) => (eventId ? s.events[eventId]?.plan : undefined));
  const activePlan = planProp ?? storePlan;
  const activeVersion = currentVersionProp ?? activePlan?.version;

  const outcomeVersion =
    basedOnVersionProp ?? ('basedOnVersion' in outcome ? (outcome as { basedOnVersion?: number }).basedOnVersion : undefined);
  const isStale =
    outcomeVersion !== undefined && activeVersion !== undefined && outcomeVersion !== activeVersion;

  const narrationText =
    typeof narrationProp === 'string'
      ? narrationProp
      : narrationProp?.text;

  return (
    <div
      className={`space-y-4 rounded-xl ${
        isStale ? 'opacity-60 border-2 border-dashed border-[#D6C7B2] p-3 bg-[#FAF5F0]' : ''
      } ${className}`}
    >
      {isStale && (
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Out of date</Badge>
          <span className="text-xs text-[#5C4556]">
            Plan has advanced to version {activeVersion}. This suggestion cannot be applied directly.
          </span>
        </div>
      )}

      {outcome.kind === 'proposal' && (
        <div className="space-y-3">
          <p className="text-sm text-[#2B1B2E]">{outcome.message}</p>
          <div className="space-y-3">
            {outcome.options.map((opt) => (
              <OptionCard
                key={opt.id}
                option={opt}
                eventId={eventId}
                plan={activePlan}
                isRecommended={opt.id === outcome.recommendedOptionId}
                disabled={isStale}
              />
            ))}
          </div>
          {outcome.notes && outcome.notes.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-[#5C4556] space-y-0.5">
              {outcome.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {outcome.kind === 'conflict' && (
        <div className="space-y-3">
          <p className="text-sm text-[#2B1B2E]">{outcome.message}</p>
          {outcome.conflicts.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              eventId={eventId}
              plan={activePlan}
              onAskToRelax={onAskToRelax}
            />
          ))}
          {outcome.options.map((opt) => (
            <OptionCard
              key={opt.id}
              option={opt}
              eventId={eventId}
              plan={activePlan}
              disabled={isStale}
            />
          ))}
        </div>
      )}

      {outcome.kind === 'info' && (
        <div className="space-y-3">
          <p className="text-sm text-[#2B1B2E]">{outcome.message}</p>
          <dl className="divide-y divide-[#E6DCD2] rounded-lg border border-[#E6DCD2] bg-[#FAF5F0] p-3 text-sm">
            {outcome.items.map((item) => (
              <div key={item.title} className="py-2 first:pt-0 last:pb-0">
                <dt className="font-semibold text-[#2B1B2E]">{item.title}</dt>
                <dd className="text-xs text-[#5C4556] mt-0.5">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {outcome.kind === 'chaos' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[#2B1B2E]">{outcome.result.headline}</h3>
              {eventId && (
                <Link
                  href={`/events/${eventId}/chaos?scenario=${outcome.result.input.type}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B2D5C] hover:text-[#55224A] hover:underline"
                >
                  <span>Open in Chaos Lab</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              )}
            </div>
            <p className="text-xs text-[#5C4556]">{outcome.result.summary}</p>
          </div>
          {narrationText && (
            <blockquote className="p-3 bg-[#FAF5F0] border-l-4 border-[#6B2D5C] rounded-r text-xs italic text-[#5C4556]">
              {narrationText}
            </blockquote>
          )}
          <div className="space-y-3">
            {outcome.result.options.map((opt) => (
              <OptionCard
                key={opt.id}
                option={opt}
                eventId={eventId}
                plan={activePlan}
                isRecommended={opt.id === outcome.result.recommendedOptionId}
                disabled={isStale}
              />
            ))}
          </div>
        </div>
      )}

      {outcome.kind === 'clarify' && (
        <p className="text-sm text-[#2B1B2E] leading-relaxed">{outcome.question}</p>
      )}

      {outcome.kind === 'reply' && (
        <p className="text-sm text-[#2B1B2E] leading-relaxed">{outcome.text}</p>
      )}

      {outcome.kind === 'error' && (
        <Alert tone="danger" title="Assistant Error">
          {outcome.message}
        </Alert>
      )}
    </div>
  );
}
