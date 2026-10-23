import { describe, expect, it } from 'vitest';
import type { EventPlan } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { buildDemoPlan } from '@/engine/demo';
import { deriveGuestMetrics } from '@/engine/guestMetrics';
import { scoreRisks } from '@/engine/risk';
import { createIdFactory } from '@/lib/id';
import { INTAKE_PROMPTS, outcomeToText, suggestedPrompts } from '@/lib/chatText';
import type { EventDerivedMetrics } from '@/store/selectors';

const ctx = { ids: createIdFactory('chat_text_test'), clock: () => new Date('2026-10-22') };

describe('Lib: chatText pure helpers', () => {
  describe('outcomeToText', () => {
    it('summarizes proposal and conflict outcomes with outcome.message', () => {
      const proposal: AssistantOutcome = {
        kind: 'proposal',
        message: 'Proposed selecting Vintage Bollywood.',
        options: [],
        notes: [],
      };
      expect(outcomeToText(proposal)).toBe('Proposed selecting Vintage Bollywood.');

      const conflict: AssistantOutcome = {
        kind: 'conflict',
        message: 'Hard cap exceeded by ₹10,000.',
        conflicts: [],
        options: [],
      };
      expect(outcomeToText(conflict)).toBe('Hard cap exceeded by ₹10,000.');
    });

    it('summarizes info outcomes with item count when items exist or message when empty', () => {
      const infoWithItems: AssistantOutcome = {
        kind: 'info',
        message: 'Here are forgotten items:',
        items: [
          { title: 'Item 1', detail: 'Why 1' },
          { title: 'Item 2', detail: 'Why 2' },
          { title: 'Item 3', detail: 'Why 3' },
          { title: 'Item 4', detail: 'Why 4' },
          { title: 'Item 5', detail: 'Why 5' },
          { title: 'Item 6', detail: 'Why 6' },
        ],
      };
      expect(outcomeToText(infoWithItems)).toBe('Here are 6 things you may be forgetting.');

      const infoNoItems: AssistantOutcome = {
        kind: 'info',
        message: 'Guest count is already 80. No changes required.',
        items: [],
      };
      expect(outcomeToText(infoNoItems)).toBe('Guest count is already 80. No changes required.');
    });

    it('summarizes chaos outcome using narration if present, else headline', () => {
      const chaosOutcome: AssistantOutcome = {
        kind: 'chaos',
        result: {
          input: { type: 'rain' },
          applicable: true,
          headline: 'Sudden rain threatens open-air celebration',
          summary: 'Options available',
          options: [],
          scoreBefore: 50,
        },
      };

      // No narration -> headline
      expect(outcomeToText(chaosOutcome)).toBe('Sudden rain threatens open-air celebration');

      // Narration object -> narration.text
      expect(outcomeToText(chaosOutcome, { text: 'Showers are likely; a canopy will keep guests dry.' })).toBe(
        'Showers are likely; a canopy will keep guests dry.',
      );

      // Narration string
      expect(outcomeToText(chaosOutcome, 'Canopy is recommended.')).toBe('Canopy is recommended.');
    });

    it('summarizes clarify, reply, and error outcomes accurately', () => {
      expect(outcomeToText({ kind: 'clarify', question: 'Which date do you prefer?' })).toBe(
        'Which date do you prefer?',
      );
      expect(outcomeToText({ kind: 'reply', text: 'Here is your advice.' })).toBe('Here is your advice.');
      expect(outcomeToText({ kind: 'error', message: 'Engine failure' })).toBe('Engine failure');
    });

    it('caps output at 600 characters', () => {
      const longMessage = 'A'.repeat(800);
      const outcome: AssistantOutcome = {
        kind: 'proposal',
        message: longMessage,
        options: [],
        notes: [],
      };
      const result = outcomeToText(outcome);
      expect(result).toHaveLength(600);
    });
  });

  describe('suggestedPrompts', () => {
    it('returns at most 5 context-aware prompts in deterministic priority order', () => {
      const { plan } = buildDemoPlan(ctx);
      // plan has concepts and selectedConceptId is null, setting is 'undecided' (not indoor), cap is 150000
      const prompts = suggestedPrompts(plan);

      expect(prompts.length).toBeLessThanOrEqual(5);
      expect(prompts[0]).toBe('Pick option 1');
      expect(prompts[1]).toBe('Increase guests from 80 to 100');
      expect(prompts[2]).toMatch(/^Where can I save ₹/);
      expect(prompts[3]).toBe('What am I forgetting?');
      expect(prompts[4]).toBe('What if it rains?');
    });

    it('shifts prompts down when a concept is already selected', () => {
      const { plan } = buildDemoPlan(ctx);
      const planWithSelected: EventPlan = {
        ...plan,
        selectedConceptId: 'concept_vintage_bollywood',
      };
      const prompts = suggestedPrompts(planWithSelected);

      expect(prompts).not.toContain('Pick option 1');
      expect(prompts[0]).toBe('Increase guests from 80 to 100');
      expect(prompts[1]).toMatch(/^Where can I save ₹/);
      expect(prompts[2]).toBe('What am I forgetting?');
      expect(prompts[3]).toBe('What if it rains?');
      expect(prompts[4]).toBe('Can we fit a live singer into this budget?');
    });

    it('omits "What if it rains?" when setting is indoor and surfaces "Make it feel expensive"', () => {
      const { plan } = buildDemoPlan(ctx);
      const indoorPlan: EventPlan = {
        ...plan,
        selectedConceptId: 'concept_vintage_bollywood',
        meta: { ...plan.meta, setting: 'indoor' },
      };
      const prompts = suggestedPrompts(indoorPlan);

      expect(prompts).not.toContain('What if it rains?');
      expect(prompts).toContain('Make it feel expensive');
      expect(prompts[prompts.length - 1]).toBe('Make it feel expensive');
    });

    it('calculates 10% saving rounded to nearest 5k and minimum 5k', () => {
      const { plan } = buildDemoPlan(ctx);
      const derived: EventDerivedMetrics = {
        budgetStatus: {
          total: 132000,
          cap: 150000,
          remaining: 18000,
          overCap: false,
          usedPercent: 88,
        },
        scoreRisks: scoreRisks(plan, ctx),
        findConflicts: [],
        findForgottenCosts: [],
        deriveGuestMetrics: deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds),
        stage: 'planning',
      };

      // 10% of 132,000 = 13,200. Nearest 5,000 = 15,000.
      const prompts = suggestedPrompts(plan, derived);
      expect(prompts).toContain('Where can I save ₹15,000?');
    });
  });

  describe('INTAKE_PROMPTS', () => {
    it('contains the four standard intake chips', () => {
      expect(INTAKE_PROMPTS).toHaveLength(4);
      expect(INTAKE_PROMPTS).toEqual([
        'Plan a wedding under ₹5 lakh',
        'Birthday party for 50 people in Pune, budget ₹80,000',
        'Anniversary for 80 guests in Mumbai under ₹1.5 lakh',
        'Community Diwali event for 200 people',
      ]);
    });
  });
});
