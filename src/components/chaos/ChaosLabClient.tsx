'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CHAOS_SCENARIO_CATALOG,
  type ChaosScenarioInput,
} from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import {
  defaultInputFor,
  scenarioAvailability,
  simulateScenario,
  type ScenarioResult,
} from '@/engine/chaos';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { engineContext } from '@/store/engineContext';
import { useEvent, useEventDerived, useStoreReady, type EventDerivedMetrics } from '@/store/selectors';
import { ChaosScoreCard } from './ChaosScoreCard';
import { RecoveryApplied } from './RecoveryApplied';
import { RiskRegister } from './RiskRegister';
import { ScenarioPicker } from './ScenarioPicker';
import { ScenarioResultView } from './ScenarioResultView';
import { StressTestPanel } from './StressTestPanel';

export interface ChaosLabClientProps {
  eventId?: string;
}

const VALID_TYPES = new Set(CHAOS_SCENARIO_CATALOG.map((c) => c.type));

function ChaosLabSkeleton() {
  return (
    <div className="py-2 space-y-6">
      <PageHeader
        title="Chaos Lab"
        description="Stress-test your celebration before reality does."
      />
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

function useAutoSimulateScenario(
  plan: EventPlan | undefined,
  onAutoSimulate: (type: ChaosScenarioInput['type'], input: ChaosScenarioInput) => void,
) {
  const searchParams = useSearchParams();
  const autoSimulatedParamRef = useRef<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    const rawParam = searchParams.get('scenario');
    if (rawParam && VALID_TYPES.has(rawParam as ChaosScenarioInput['type'])) {
      const type = rawParam as ChaosScenarioInput['type'];
      if (autoSimulatedParamRef.current !== type) {
        autoSimulatedParamRef.current = type;
        const initialInput = defaultInputFor(plan, type);
        onAutoSimulate(type, initialInput);
      }
    }
  }, [searchParams, plan, onAutoSimulate]);
}

interface ChaosLabContentProps {
  eventId: string;
  plan: EventPlan;
  derived: EventDerivedMetrics;
}

function ChaosLabContent({ eventId, plan, derived }: ChaosLabContentProps) {
  const [selectedType, setSelectedType] = useState<ChaosScenarioInput['type']>('rain');
  const [input, setInput] = useState<ChaosScenarioInput>({ type: 'rain' });
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [versionSimulated, setVersionSimulated] = useState<number>(0);
  const [appliedNotice, setAppliedNotice] = useState<{
    scoreBefore: number;
    scoreAfter: number;
    budgetTotalAfter: number;
  } | null>(null);

  const pickerRef = useRef<HTMLDivElement | null>(null);

  const runSim = (scenarioInput: ChaosScenarioInput) => {
    const res = simulateScenario(plan, scenarioInput, engineContext);
    setResult(res);
    setVersionSimulated(plan.version);
    setAppliedNotice(null);
  };

  useAutoSimulateScenario(plan, (type, initialInput) => {
    setSelectedType(type);
    setInput(initialInput);
    const res = simulateScenario(plan, initialInput, engineContext);
    setResult(res);
    setVersionSimulated(plan.version);
  });

  const handleSelectType = (newType: ChaosScenarioInput['type']) => {
    setSelectedType(newType);
    setInput(defaultInputFor(plan, newType));
  };

  const handleTestRiskScenario = (type: ChaosScenarioInput['type']) => {
    handleSelectType(type);
    pickerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showRainSuggestion =
    plan.meta.setting !== 'indoor' &&
    scenarioAvailability(plan, 'rain').available &&
    !result;

  return (
    <div className="py-2 space-y-8">
      <PageHeader
        title="Chaos Lab"
        description="Stress-test your celebration before reality does."
      />

      {appliedNotice && (
        <RecoveryApplied
          eventId={eventId}
          scoreBefore={appliedNotice.scoreBefore}
          scoreAfter={appliedNotice.scoreAfter}
          budgetTotalAfter={appliedNotice.budgetTotalAfter}
          onDismiss={() => setAppliedNotice(null)}
        />
      )}

      {!plan.selectedConceptId && (
        <Alert tone="info">
          <p className="font-semibold text-sm mb-1">Draft celebration plan</p>
          This plan does not have a selected concept yet. Disruption simulations will sharpen and calculate exact rate-card quality profiles after a creative concept is chosen.
        </Alert>
      )}

      {/* 1. Your Chaos Score */}
      <section aria-labelledby="chaos-score-heading" className="space-y-3">
        <h2 id="chaos-score-heading" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Your Chaos Score
        </h2>
        <ChaosScoreCard plan={plan} derived={derived} />
      </section>

      {/* 2. Simulate a problem */}
      <section aria-labelledby="simulate-heading" className="space-y-3" ref={pickerRef}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="simulate-heading" className="text-lg font-serif font-bold text-[#2B1B2E]">
            Simulate a problem
          </h2>

          {showRainSuggestion && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                handleSelectType('rain');
                runSim({ type: 'rain' });
              }}
            >
              Suggested first test: rain
            </Button>
          )}
        </div>

        <ScenarioPicker
          plan={plan}
          selectedType={selectedType}
          onSelectType={handleSelectType}
          input={input}
          onChangeInput={setInput}
          onSimulate={runSim}
        />
      </section>

      {/* 3. Result (only when present) */}
      {result && (
        <section aria-labelledby="result-heading" className="space-y-3">
          <h2 id="result-heading" className="text-lg font-serif font-bold text-[#2B1B2E]">
            Result
          </h2>
          <ScenarioResultView
            plan={plan}
            eventId={eventId}
            result={result}
            versionSimulatedAgainst={versionSimulated}
            onResimulate={() => runSim(input)}
            onOptionApplied={(applied) => {
              setAppliedNotice(applied);
            }}
          />
        </section>
      )}

      {/* 4. Full stress test */}
      <section aria-labelledby="stress-test-heading" className="space-y-3">
        <h2 id="stress-test-heading" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Full stress test
        </h2>
        <StressTestPanel
          plan={plan}
          onOpenScenario={(openType) => {
            handleSelectType(openType);
            runSim(defaultInputFor(plan, openType));
            pickerRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </section>

      {/* 5. Risk register */}
      <section aria-labelledby="risk-register-heading" className="space-y-3">
        <h2 id="risk-register-heading" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Risk register
        </h2>
        <RiskRegister
          risks={derived.scoreRisks.risks}
          breakdown={derived.scoreRisks.breakdown}
          onSelectScenario={handleTestRiskScenario}
        />
      </section>
    </div>
  );
}

export function ChaosLabClient({ eventId: propEventId }: ChaosLabClientProps) {
  const params = useParams();
  const eventId = propEventId ?? (typeof params?.id === 'string' ? params.id : '');
  const isReady = useStoreReady();
  const event = useEvent(eventId);
  const derived = useEventDerived(eventId);

  const plan = event?.plan;

  if (!isReady || !plan || !derived) {
    return <ChaosLabSkeleton />;
  }

  return <ChaosLabContent eventId={eventId} plan={plan} derived={derived} />;
}
