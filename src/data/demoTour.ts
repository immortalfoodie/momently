import { DEMO_SCENARIO } from './demoScenario';

export type DemoTourStepKind = 'intake' | 'chat' | 'navigate';

export interface DemoTourStep {
  stepId: string;
  kind: DemoTourStepKind;
  path?: string;
  title: string;
  whyItMatters: string;
  lookFor: string;
  userMessage: string;
}

function getScriptedMessage(stepId: string): string {
  const found = DEMO_SCENARIO.scriptedSteps.find((s) => s.id === stepId);
  if (!found) {
    throw new Error(`Missing scripted step in DEMO_SCENARIO: ${stepId}`);
  }
  return found.userMessage;
}

/**
 * Six-step guided demo tour aligned 1:1 with DEMO_SCENARIO.scriptedSteps.
 * WHY: Walks evaluators through Vibe-to-Vision intake, concept selection, Budget Guardian
 * trade-offs, guest scaling, Chaos Lab rain recovery, and the final event kit without
 * ever auto-approving changes on the user's behalf.
 */
export const DEMO_TOUR: readonly DemoTourStep[] = [
  {
    stepId: 'step_1_intake',
    kind: 'intake',
    title: 'Vibe-to-Vision Intake',
    whyItMatters:
      'Turns an unstructured celebration story into a complete, constraint-checked plan and three distinct concepts.',
    lookFor:
      'Watch how the ₹1.5 lakh hard cap, 80 guests, Mumbai tier-1 pricing, and three tailored concepts initialize automatically.',
    userMessage: getScriptedMessage('step_1_intake'),
  },
  {
    stepId: 'step_2_select_concept',
    kind: 'chat',
    title: 'Pick the Vintage Bollywood Concept',
    whyItMatters:
      'Selecting a creative direction translates aesthetic preferences into concrete rate-card quality tiers.',
    lookFor:
      'Notice the assistant proposes a concept patch in chat with exact line-item diffs that waits for your approval click.',
    userMessage: getScriptedMessage('step_2_select_concept'),
  },
  {
    stepId: 'step_3_upgrade_decor',
    kind: 'chat',
    title: 'Upgrade Decor with Budget Guardian',
    whyItMatters:
      'Upgrading one priority category under a fixed budget cap requires transparent, non-destructive trade-offs elsewhere.',
    lookFor:
      'Inspect how the funding options step down other flexible items while strictly protecting the upgraded decor family.',
    userMessage: getScriptedMessage('step_3_upgrade_decor'),
  },
  {
    stepId: 'step_4_increase_guests',
    kind: 'chat',
    title: 'Increase Guests from 80 to 110',
    whyItMatters:
      'A living celebration plan scales per-guest catering, seating tables, and contingency reserves while honoring locked items.',
    lookFor:
      'Compare the option that rebalances quality to hold the ₹1.5 lakh cap against the option that raises the cap.',
    userMessage: getScriptedMessage('step_4_increase_guests'),
  },
  {
    stepId: 'step_5_rain_contingency',
    kind: 'chat',
    title: 'What If It Rains? (Chaos Lab)',
    whyItMatters:
      'Stress-testing weather risk before event day turns potential panic into an actionable, pre-priced recovery plan.',
    lookFor:
      'Check the Chaos Score reduction across the canopy cover and standby indoor backup hall recovery options.',
    userMessage: getScriptedMessage('step_5_rain_contingency'),
  },
  {
    stepId: 'step_6_final_checklist',
    kind: 'navigate',
    path: 'checklist',
    title: 'The Event Kit & Final Checklist',
    whyItMatters:
      'Every approved decision and contingency task flows into an actionable execution checklist ready for event week.',
    lookFor:
      'Review the prioritized tasks, due-date windows, and export controls on the checklist page.',
    userMessage: getScriptedMessage('step_6_final_checklist'),
  },
];
