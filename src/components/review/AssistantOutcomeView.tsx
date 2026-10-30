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
import { StepList } from './StepList';

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

/** Shared context every outcome renderer needs. */
interface OutcomeContext {
  eventId?: string;
  plan?: EventPlan;
  isStale: boolean;
  narrationText?: string;
  onAskToRelax?: (conflict: Conflict, resolution: ResolutionOption) => void;
}

type OutcomeOf<K extends AssistantOutcome['kind']> = Extract<AssistantOutcome, { kind: K }>;

function ProposalOutcome({ outcome, ctx }: { outcome: OutcomeOf<'proposal'>; ctx: OutcomeContext }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{outcome.message}</p>
      {outcome.steps && <StepList steps={outcome.steps} />}
      <div className="space-y-3">
        {outcome.options.map((opt) => (
          <OptionCard
            key={opt.id}
            option={opt}
            eventId={ctx.eventId}
            plan={ctx.plan}
            isRecommended={opt.id === outcome.recommendedOptionId}
            disabled={ctx.isStale}
          />
        ))}
      </div>
      {outcome.notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-ink-muted space-y-0.5">
          {outcome.notes.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConflictOutcome({ outcome, ctx }: { outcome: OutcomeOf<'conflict'>; ctx: OutcomeContext }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{outcome.message}</p>
      {outcome.conflicts.map((c) => (
        <ConflictCard key={c.id} conflict={c} eventId={ctx.eventId} plan={ctx.plan} onAskToRelax={ctx.onAskToRelax} />
      ))}
      {outcome.options.map((opt) => (
        <OptionCard key={opt.id} option={opt} eventId={ctx.eventId} plan={ctx.plan} disabled={ctx.isStale} />
      ))}
    </div>
  );
}

function InfoOutcome({ outcome }: { outcome: OutcomeOf<'info'> }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{outcome.message}</p>
      {outcome.steps ? (
        <StepList steps={outcome.steps} />
      ) : (
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface-warm p-3 text-sm">
          {outcome.items.map((item) => (
            <div key={item.title} className="py-2 first:pt-0 last:pb-0">
              <dt className="font-semibold text-ink">{item.title}</dt>
              <dd className="text-xs text-ink-muted mt-0.5">{item.detail}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ChaosOutcome({ outcome, ctx }: { outcome: OutcomeOf<'chaos'>; ctx: OutcomeContext }) {
  const { result } = outcome;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">{result.headline}</h3>
          {ctx.eventId && (
            <Link
              href={`/events/${ctx.eventId}/chaos?scenario=${result.input.type}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
            >
              <span>Open in Chaos Lab</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
        <p className="text-xs text-ink-muted">{result.summary}</p>
      </div>
      {ctx.narrationText && (
        <blockquote className="p-3 bg-surface-warm border-l-4 border-primary rounded-r text-xs italic text-ink-muted">
          {ctx.narrationText}
        </blockquote>
      )}
      <div className="space-y-3">
        {result.options.map((opt) => (
          <OptionCard
            key={opt.id}
            option={opt}
            eventId={ctx.eventId}
            plan={ctx.plan}
            isRecommended={opt.id === result.recommendedOptionId}
            disabled={ctx.isStale}
          />
        ))}
      </div>
    </div>
  );
}

function OutcomeBody({ outcome, ctx }: { outcome: AssistantOutcome; ctx: OutcomeContext }) {
  switch (outcome.kind) {
    case 'proposal':
      return <ProposalOutcome outcome={outcome} ctx={ctx} />;
    case 'conflict':
      return <ConflictOutcome outcome={outcome} ctx={ctx} />;
    case 'info':
      return <InfoOutcome outcome={outcome} />;
    case 'chaos':
      return <ChaosOutcome outcome={outcome} ctx={ctx} />;
    case 'clarify':
      return <p className="text-sm text-ink leading-relaxed">{outcome.question}</p>;
    case 'reply':
      return <p className="text-sm text-ink leading-relaxed">{outcome.text}</p>;
    case 'error':
      return (
        <Alert tone="danger" title="Assistant Error">
          {outcome.message}
        </Alert>
      );
  }
}

/**
 * Decides whether an outcome was built against an older plan version.
 *
 * @param outcomeVersion - Version the outcome was based on, if known.
 * @param activeVersion - Current plan version, if known.
 * @returns True only when both versions are known and differ.
 */
export function isOutcomeStale(outcomeVersion?: number, activeVersion?: number): boolean {
  return outcomeVersion !== undefined && activeVersion !== undefined && outcomeVersion !== activeVersion;
}

function narrationToText(narration: AssistantOutcomeViewProps['narration']): string | undefined {
  return typeof narration === 'string' ? narration : narration?.text;
}

/**
 * Renders any variant of AssistantOutcome with strict type safety, visual dimming when stale,
 * and seamless delegation to specialized review primitives.
 *
 * ACCESSIBILITY & DATA-FLOW DECISION (WHY):
 * Stale outcomes (based on superseded plan revisions) are dimmed and marked with an "Out of date"
 * badge with approve controls disabled to guarantee host safety.
 */
export function AssistantOutcomeView({
  outcome,
  eventId,
  plan,
  currentVersion,
  basedOnVersion,
  narration,
  onAskToRelax,
  className,
}: AssistantOutcomeViewProps) {
  const storePlan = useEventsStore((s) => (eventId ? s.events[eventId]?.plan : undefined));
  const activePlan = plan ?? storePlan;
  const activeVersion = currentVersion ?? activePlan?.version;
  const isStale = isOutcomeStale(basedOnVersion, activeVersion);

  const ctx: OutcomeContext = {
    eventId,
    plan: activePlan,
    isStale,
    narrationText: narrationToText(narration),
    onAskToRelax,
  };

  return (
    <div
      className={`space-y-4 rounded-xl ${
        isStale ? 'border-2 border-dashed border-[#D6C7B2] bg-surface-warm p-3 opacity-60' : ''
      } ${className ?? ''}`}
    >
      {isStale && (
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Out of date</Badge>
          <span className="text-xs text-ink-muted">
            Plan has advanced to version {activeVersion}. This suggestion cannot be applied directly.
          </span>
        </div>
      )}
      <OutcomeBody outcome={outcome} ctx={ctx} />
    </div>
  );
}
