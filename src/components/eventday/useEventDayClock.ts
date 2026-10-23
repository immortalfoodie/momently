'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { isEventToday } from '@/engine/eventDay';
import { localIsoDate, minuteOfDay } from '@/lib/time';
import { useEngineContext } from '@/store/engineContext';

export interface EventDayClockState {
  mode: 'live' | 'practice';
  minute: number;
  today: string;
  canGoLive: boolean;
  goLive: () => void;
  practice: () => void;
  setPracticeMinute: (minute: number) => void;
  nudge: (deltaMinutes: number) => void;
}

/**
 * Clock coordinator driving Event Day live tracking and interactive timeline practice.
 * WHY: Enables hosts to rehearse their celebration run-of-show offline or track active slots live.
 *
 * @param plan - Current EventPlan with meta date and schedule.
 * @returns EventDayClockState with mode, minute of day, live/practice toggle, and time nudgers.
 */
export function useEventDayClock(plan: EventPlan | null | undefined): EventDayClockState {
  const { clock } = useEngineContext();
  const now = clock();
  const canGoLive = plan ? isEventToday(plan, now) : false;

  const defaultPracticeMinute = useMemo(() => {
    if (!plan || plan.schedule.length === 0) return 600;
    const firstStart = Math.min(...plan.schedule.map((s) => s.startMinute));
    return Math.max(0, firstStart - 30);
  }, [plan]);

  const [requestedMode, setRequestedMode] = useState<'live' | 'practice'>('live');
  const mode: 'live' | 'practice' = canGoLive && requestedMode === 'live' ? 'live' : 'practice';

  const [practiceMinute, setPracticeMinuteState] = useState<number>(defaultPracticeMinute);
  const [liveMinute, setLiveMinute] = useState<number>(() => minuteOfDay(clock()));

  useEffect(() => {
    if (mode !== 'live') return;

    const timer = setInterval(() => {
      setLiveMinute(minuteOfDay(clock()));
    }, 30_000);

    return () => clearInterval(timer);
  }, [mode, clock]);

  const goLive = () => {
    if (canGoLive) {
      setLiveMinute(minuteOfDay(clock()));
      setRequestedMode('live');
    }
  };

  const practice = () => {
    setRequestedMode('practice');
  };

  const setPracticeMinute = (min: number) => {
    const clamped = Math.max(0, Math.min(1439, Math.round(min)));
    setPracticeMinuteState(clamped);
  };

  const nudge = (deltaMinutes: number) => {
    setPracticeMinuteState((prev) => Math.max(0, Math.min(1439, prev + deltaMinutes)));
  };

  const minute = mode === 'live' ? liveMinute : practiceMinute;
  const today = localIsoDate(now);

  return {
    mode,
    minute,
    today,
    canGoLive,
    goLive,
    practice,
    setPracticeMinute,
    nudge,
  };
}
