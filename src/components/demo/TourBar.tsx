'use client';

import { useContext, useEffect, useState } from 'react';
import * as NextNavigation from 'next/navigation';
import { ChatContext, ChatProvider, useChat } from '@/components/chat/ChatProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { DEMO_TOUR } from '@/data/demoTour';
import { submitIntake } from '@/lib/apiClient';
import { useEventsStore } from '@/store/eventsStore';
import { useTourStore } from '@/store/tourStore';

function useOptionalRouter(): { push: (href: string) => void } | undefined {
  try {
    return NextNavigation.useRouter();
  } catch {
    return undefined;
  }
}

function TourBarInner() {
  const router = useOptionalRouter();
  const { announce } = useAnnouncer();
  const chat = useChat();

  const active = useTourStore((s) => s.active);
  const index = useTourStore((s) => s.index);
  const tourEventId = useTourStore((s) => s.eventId);
  const ranSteps = useTourStore((s) => s.ranSteps);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const exit = useTourStore((s) => s.exit);
  const markRan = useTourStore((s) => s.markRan);
  const setEventId = useTourStore((s) => s.setEventId);

  const [runningIntake, setRunningIntake] = useState(false);
  const [warningStepIndex, setWarningStepIndex] = useState<number | null>(null);

  const step = DEMO_TOUR[index] ?? DEMO_TOUR[0];
  const totalSteps = DEMO_TOUR.length;

  useEffect(() => {
    if (!active || !step) return;
    announce(`Step ${index + 1} of ${totalSteps}: ${step.title}`);
  }, [active, index, step, totalSteps, announce]);

  if (!active || !step) {
    return null;
  }

  const runIntakeStep = async (brief: string) => {
    setRunningIntake(true);
    try {
      let createdId: string;
      try {
        const res = await submitIntake(brief);
        if (res.ok) {
          createdId = useEventsStore.getState().createEvent(res.value.plan, {
            assumptions: res.value.assumptions,
            missingInfo: res.value.missingInfo,
          });
        } else {
          createdId = useEventsStore.getState().createDemoEvent();
        }
      } catch {
        createdId = useEventsStore.getState().createDemoEvent();
      }
      setEventId(createdId);
      markRan(index);
      setWarningStepIndex(null);
      router?.push(`/events/${createdId}/concepts`);
    } finally {
      setRunningIntake(false);
    }
  };

  const handleRunStep = async () => {
    if (step.kind === 'intake') {
      await runIntakeStep(step.userMessage);
      return;
    }

    const activeEventId = chat.eventId ?? tourEventId;
    const eventExists = Boolean(
      activeEventId && useEventsStore.getState().events[activeEventId],
    );

    if (!activeEventId || !eventExists) {
      const warning =
        'Step 1 must run first to create the demo celebration before running this step.';
      setWarningStepIndex(index);
      announce(warning);
      return;
    }

    setWarningStepIndex(null);
    markRan(index);

    if (step.kind === 'chat') {
      await chat.send(step.userMessage);
      return;
    }

    if (step.kind === 'navigate') {
      const targetSuffix = step.path ?? 'checklist';
      router?.push(`/events/${activeEventId}/${targetSuffix}`);
    }
  };

  const hasRanCurrent = ranSteps.includes(index);
  const showApprovalHint = step.kind === 'chat' && hasRanCurrent;

  return (
    <div
      role="region"
      aria-label="Demo guide"
      className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-[#6B2D5C] bg-[#FAF5F0] text-[#2B1B2E] shadow-xl px-4 py-3 sm:px-6"
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Badge tone="brand">
              Step {index + 1} of {totalSteps}
            </Badge>
            <h2 className="font-serif text-base font-bold text-[#2B1B2E]">
              {step.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={runningIntake || chat.pending}
              onClick={() => {
                void handleRunStep();
              }}
            >
              Run this step
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={index === 0}
              onClick={back}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={index >= totalSteps - 1}
              onClick={next}
            >
              Next
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={exit}
            >
              Exit demo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5B4A5E]">
          <p>
            <strong className="text-[#2B1B2E]">Why it matters:</strong> {step.whyItMatters}
          </p>
          <p>
            <strong className="text-[#2B1B2E]">What to look for:</strong> {step.lookFor}
          </p>
        </div>

        {showApprovalHint && (
          <p className="text-xs font-semibold text-[#6B2D5C] bg-[#F4EDE6] border border-[#E2D2DC] rounded-lg px-3 py-1.5">
            Now review the proposal and approve it yourself. Momently never applies a change on its own.
          </p>
        )}

        {warningStepIndex === index && (
          <p role="alert" className="text-xs font-semibold text-[#A12B3A]">
            Step 1 must run first to create the demo celebration before running this step.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Interactive, non-modal guided tour bar walking users through the 6-step celebration planning flow.
 * Never traps keyboard focus and never auto-approves proposals on the user's behalf.
 */
export function TourBar() {
  const parentContext = useContext(ChatContext);
  if (!parentContext) {
    return (
      <ChatProvider>
        <TourBarInner />
      </ChatProvider>
    );
  }
  return <TourBarInner />;
}
