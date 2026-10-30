'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CHAOS_SCENARIO_CATALOG, type ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import {
  buildDescribeContext,
  reconcileDescribedScenarios,
  type DroppedScenario,
} from '@/engine/chaos';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { TextArea } from '@/components/ui/TextArea';
import { describeChaos } from '@/lib/apiClient';
import { CHAOS_DESCRIBE_MAX_CHARS } from '@/llm/schemas/chaosDescribe';

export interface DescribeScenarioProps {
  plan: EventPlan;
  onRun: (input: ChaosScenarioInput) => void;
}

interface DescribeOutcome {
  understood: string;
  unsupported: string | null;
  accepted: ChaosScenarioInput[];
  dropped: DroppedScenario[];
  degraded: boolean;
}

const EXAMPLES = [
  'Heavy rain and the photographer just cancelled',
  'Guests are stuck in traffic, everything starts 2 hours late',
  '30 more guests are coming and the cake is sold out',
];

/**
 * Short, human label for a scenario including its parameters.
 *
 * @param input - Scenario to describe.
 * @returns e.g. "Timeline running late · 120 min".
 */
export function scenarioChipLabel(input: ChaosScenarioInput): string {
  const base = CHAOS_SCENARIO_CATALOG.find((c) => c.type === input.type)?.label ?? input.type;
  switch (input.type) {
    case 'budget_cut':
      return `${base} · ${input.percent}%`;
    case 'guest_surge':
      return `${base} · +${input.extraGuests}`;
    case 'vendor_cancels':
      return `${base} · ${input.category}`;
    case 'late_start':
      return `${base} · ${input.delayMinutes} min`;
    case 'item_unavailable':
      return `${base} · ${input.family}`;
    default:
      return base;
  }
}

function OutcomeView({
  outcome,
  activeIndex,
  onPick,
}: {
  outcome: DescribeOutcome;
  activeIndex: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="space-y-3" data-testid="describe-outcome">
      <p className="text-sm text-[#2B1B2E]">
        <span className="font-semibold">Here&apos;s how I understood it: </span>
        {outcome.understood}
      </p>
      {outcome.accepted.length > 1 && (
        <div role="group" aria-label="Problems found" className="flex flex-wrap gap-2">
          {outcome.accepted.map((s, i) => (
            <Button
              key={s.type}
              size="sm"
              variant={i === activeIndex ? 'primary' : 'secondary'}
              aria-pressed={i === activeIndex}
              onClick={() => onPick(i)}
            >
              {i + 1}. {scenarioChipLabel(s)}
            </Button>
          ))}
        </div>
      )}
      {outcome.dropped.map((d) => (
        <p key={d.input.type} className="text-xs text-[#5C4556]">
          Skipped {scenarioChipLabel(d.input)}: {d.reason}
        </p>
      ))}
      {outcome.unsupported && <Alert tone="info">{outcome.unsupported}</Alert>}
      {outcome.degraded && (
        <p className="text-xs text-[#5C4556]">Live AI was unavailable, so the offline reader handled this.</p>
      )}
    </div>
  );
}

/**
 * Free-text "describe your own disaster" input for Chaos Lab.
 * WHY: Hosts think in stories, not scenario menus. The language model maps the story to typed
 * scenarios, the engine re-checks them against the plan, and the existing simulator runs them.
 * Nothing is applied without the host approving a recovery option.
 */
export function DescribeScenario({ plan, onRun }: DescribeScenarioProps) {
  const searchParams = useSearchParams();
  // The guided tour pre-fills a story via ?describe=; the host still presses the button.
  const [text, setText] = useState(() => (searchParams.get('describe') ?? '').slice(0, CHAOS_DESCRIBE_MAX_CHARS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DescribeOutcome | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { announce } = useAnnouncer();

  const pick = (index: number, accepted: ChaosScenarioInput[]) => {
    const input = accepted[index];
    if (!input) return;
    setActiveIndex(index);
    onRun(input);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Describe what might go wrong first.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await describeChaos({ text: trimmed, ...buildDescribeContext(plan) });
    setLoading(false);
    if (!res.ok) {
      setOutcome(null);
      setError(res.error.message);
      return;
    }
    const { accepted, dropped } = reconcileDescribedScenarios(plan, res.value.scenarios);
    setOutcome({ ...res.value, accepted, dropped });
    announce(
      accepted.length > 0
        ? `${res.value.understood} Found ${accepted.length} problem${accepted.length === 1 ? '' : 's'} to simulate.`
        : res.value.understood,
    );
    pick(0, accepted);
  };

  return (
    <Card className="p-6 border-[#E6DCD2] bg-white space-y-4">
      <div className="flex items-start gap-3">
        <Icon name="sparkle" size={18} className="mt-1 text-[#6B2D5C]" aria-hidden="true" />
        <div>
          <h3 className="text-base font-semibold text-[#2B1B2E]">Describe your own disaster</h3>
          <p className="text-sm text-[#5C4556]">
            Say it in your own words, in English or Hinglish. The AI works out which problems to test, and the planner
            calculates the impact.
          </p>
        </div>
      </div>

      <Field label="What could go wrong?" error={error ?? undefined}>
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAOS_DESCRIBE_MAX_CHARS}
          showCount
          rows={3}
          placeholder="e.g. It starts pouring and the DJ cancels an hour before"
        />
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Example problems">
        {EXAMPLES.map((example) => (
          <Button key={example} size="sm" variant="ghost" onClick={() => setText(example)}>
            {example}
          </Button>
        ))}
      </div>

      <Button type="button" variant="primary" loading={loading} onClick={submit}>
        Simulate my scenario
      </Button>

      {outcome && (
        <OutcomeView outcome={outcome} activeIndex={activeIndex} onPick={(i) => pick(i, outcome.accepted)} />
      )}
    </Card>
  );
}
