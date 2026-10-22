'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { engineContext } from '@/store/engineContext';
import { GuardianFormCards, type GuardianToolKey } from './GuardianFormCards';

export interface GuardianPanelProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

/**
 * GuardianPanel providing 5 deterministic budgeting tools that run locally without network latency.
 * WHY: Answers "Can we afford this?", "Where can we save?", and "What am I forgetting?" offline.
 */
export function GuardianPanel({
  plan,
  eventId,
  className = '',
}: GuardianPanelProps) {
  const [activeTool, setActiveTool] = useState<GuardianToolKey | null>(null);
  const [outcome, setOutcome] = useState<AssistantOutcome | null>(null);
  const [outcomePlanVersion, setOutcomePlanVersion] = useState<number | null>(null);

  // Stale check: outcome is invalidated if plan version shifts
  const isStale = outcomePlanVersion !== null && outcomePlanVersion !== plan.version;
  const currentOutcome = isStale ? null : outcome;

  const switchTool = (tool: GuardianToolKey) => {
    if (activeTool !== tool) {
      setActiveTool(tool);
      setOutcome(null);
      setOutcomePlanVersion(null);
    }
  };

  const handleOutcome = (res: AssistantOutcome) => {
    setOutcome(res);
    setOutcomePlanVersion(plan.version);
  };

  const getToday = () => new Date().toISOString().split('T')[0] ?? '2026-01-01';

  const runPremium = () => {
    switchTool('premium');
    const res = resolveIntent(plan, { kind: 'make_it_premium' }, engineContext, getToday());
    handleOutcome(res);
  };

  const runForgotten = () => {
    switchTool('forgotten');
    const res = resolveIntent(plan, { kind: 'find_forgotten' }, engineContext, getToday());
    handleOutcome(res);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[#5B4A5E]">
        <p>Instant pure engine evaluation: no network calls, runs completely offline.</p>
        <p className="italic">
          Prices are host inputs or rate-card estimates; nothing is a vendor quote.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tool 1, 2, 3 Form Cards */}
        <GuardianFormCards
          plan={plan}
          activeTool={activeTool}
          onSelectTool={switchTool}
          onOutcome={handleOutcome}
        />

        {/* Tool 4: Make it feel expensive */}
        <Card
          className={`p-4 bg-white border transition-colors ${
            activeTool === 'premium'
              ? 'border-[#6B2D5C] ring-1 ring-[#6B2D5C]'
              : 'border-[#E6DCD2]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="sparkle" size={16} className="text-[#6B2D5C]" aria-hidden="true" />
            <h3 className="font-serif font-bold text-sm text-[#2B1B2E]">Make it feel expensive</h3>
          </div>
          <p className="text-xs text-[#5B4A5E] mb-3">
            Guests notice lighting, decor, and music far more than favours or transport.
          </p>
          <Button size="sm" variant="secondary" onClick={runPremium} className="w-full">
            Prioritize High-Impact Style
          </Button>
        </Card>

        {/* Tool 5: What am I forgetting? */}
        <Card
          className={`p-4 bg-white border transition-colors ${
            activeTool === 'forgotten'
              ? 'border-[#6B2D5C] ring-1 ring-[#6B2D5C]'
              : 'border-[#E6DCD2]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="alert" size={16} className="text-[#8A5A00]" aria-hidden="true" />
            <h3 className="font-serif font-bold text-sm text-[#2B1B2E]">What am I forgetting?</h3>
          </div>
          <p className="text-xs text-[#5B4A5E] mb-3">
            Uncover unpriced gotchas: venue security deposits, licenses, taxes, and overtime.
          </p>
          <Button size="sm" variant="secondary" onClick={runForgotten} className="w-full">
            Scan Hidden Reminders
          </Button>
        </Card>
      </div>

      {currentOutcome && (
        <Card className="p-4 bg-[#FAF5F0] border border-[#E6DCD2] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-semibold text-sm text-[#2B1B2E]">
              Guardian Recommendation
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setOutcome(null)}>
              Dismiss
            </Button>
          </div>
          <AssistantOutcomeView
            outcome={currentOutcome}
            eventId={eventId}
            plan={plan}
            currentVersion={plan.version}
            basedOnVersion={outcomePlanVersion ?? undefined}
          />
        </Card>
      )}
    </div>
  );
}
