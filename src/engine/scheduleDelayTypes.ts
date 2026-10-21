import type { PlanPatchOp, ScheduleSlot } from '@/domain/types';

export type DelayStrategy = 'cascade' | 'absorb' | 'swap';

export interface ScheduleOutcome {
  strategy: DelayStrategy;
  slots: ScheduleSlot[];
  moved: Array<{ id: string; fromStart: number; toStart: number }>;
  shortened: Array<{ id: string; fromDuration: number; toDuration: number }>;
  dropped: string[];
  overflowMinutes: number;
  feasible: boolean;
  summary: string;
  ops: PlanPatchOp[];
}

export interface ScheduleDelayInput {
  anchorSlotId: string;
  delayMinutes: number;
  endLimitMinute?: number;
}

export interface ScheduleValidation {
  overlaps: Array<[string, string]>;
  gaps: Array<{ afterSlotId: string; minutes: number }>;
  totalSlackMinutes: number;
}
