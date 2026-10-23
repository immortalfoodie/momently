import { create } from 'zustand';
import { DEMO_TOUR } from '@/data/demoTour';

export interface TourState {
  active: boolean;
  index: number;
  eventId: string | null;
  ranSteps: number[];
  start: (eventId?: string | null) => void;
  next: () => void;
  back: () => void;
  exit: () => void;
  markRan: (index: number) => void;
  setEventId: (id: string | null) => void;
}

/**
 * Ephemeral, non-persisted Zustand store managing the guided 6-step demo tour.
 * WHY: Keeps tour progress in memory across route transitions without polluting persisted user storage
 * or mutating active event plans.
 */
export const useTourStore = create<TourState>()((set) => ({
  active: false,
  index: 0,
  eventId: null,
  ranSteps: [],

  start: (eventId = null) =>
    set({
      active: true,
      index: 0,
      eventId: eventId ?? null,
      ranSteps: [],
    }),

  next: () =>
    set((state) => ({
      index: Math.min(DEMO_TOUR.length - 1, state.index + 1),
    })),

  back: () =>
    set((state) => ({
      index: Math.max(0, state.index - 1),
    })),

  exit: () =>
    set({
      active: false,
      index: 0,
      eventId: null,
      ranSteps: [],
    }),

  markRan: (stepIndex) =>
    set((state) => ({
      ranSteps: state.ranSteps.includes(stepIndex)
        ? state.ranSteps
        : [...state.ranSteps, stepIndex],
    })),

  setEventId: (id) => set({ eventId: id }),
}));
