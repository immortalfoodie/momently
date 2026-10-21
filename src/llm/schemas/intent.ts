import { chaosScenarioInputSchema } from '@/domain/chaosSchemas';
import {
  budgetCategorySchema,
  eventSettingSchema,
  qualityLevelSchema,
} from '@/domain/schemas';
import { planSummarySchema } from '@/llm/context';
import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(300),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const intentInputSchema = z.object({
  message: z.string().min(1).max(500),
  planSummary: planSummarySchema,
  recentMessages: z.array(chatMessageSchema).max(6),
});

export type IntentInput = z.infer<typeof intentInputSchema>;

export const changeGuestCountIntentSchema = z.object({
  kind: z.literal('change_guest_count'),
  guestCount: z.number().int().min(1).max(5000),
});

export const changeBudgetIntentSchema = z.object({
  kind: z.literal('change_budget'),
  amount: z.number().int().nonnegative(),
  hard: z.boolean(),
});

export const adjustCategoryIntentSchema = z.object({
  kind: z.literal('adjust_category'),
  category: budgetCategorySchema,
  percent: z.number().int().min(-90).max(200),
});

export const upgradeIntentSchema = z.object({
  kind: z.literal('upgrade'),
  family: z.string().min(1),
  toQuality: qualityLevelSchema,
});

export const downgradeIntentSchema = z.object({
  kind: z.literal('downgrade'),
  family: z.string().min(1),
  toQuality: qualityLevelSchema,
});

export const saveMoneyIntentSchema = z.object({
  kind: z.literal('save_money'),
  amount: z.number().int().positive(),
});

export const affordCheckIntentSchema = z.object({
  kind: z.literal('afford_check'),
  description: z.string().min(1).max(120),
  family: z.string().min(1).nullable(),
  userStatedCost: z.number().int().nonnegative().nullable(),
});

export const findForgottenIntentSchema = z.object({
  kind: z.literal('find_forgotten'),
});

export const makeItPremiumIntentSchema = z.object({
  kind: z.literal('make_it_premium'),
});

export const simulateIntentSchema = z.object({
  kind: z.literal('simulate'),
  scenario: chaosScenarioInputSchema,
});

export const selectConceptIntentSchema = z.object({
  kind: z.literal('select_concept'),
  conceptRef: z.string().min(1).max(80),
});

export const combineConceptsIntentSchema = z.object({
  kind: z.literal('combine_concepts'),
  baseRef: z.string().min(1).max(80),
  borrowRef: z.string().min(1).max(80),
  borrowCategories: z.array(budgetCategorySchema).max(5),
  percentCheaper: z.number().int().min(0).max(60).nullable(),
});

export const addPreferenceIntentSchema = z.object({
  kind: z.literal('add_preference'),
  preferenceKind: z.enum(['must_have', 'avoid', 'style', 'dietary', 'accessibility']),
  description: z.string().min(1).max(200),
  severity: z.enum(['hard', 'soft']),
});

export const setSettingIntentSchema = z.object({
  kind: z.literal('set_setting'),
  setting: eventSettingSchema,
});

export const setDateIntentSchema = z.object({
  kind: z.literal('set_date'),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const answerIntentSchema = z.object({
  kind: z.literal('answer'),
  reply: z.string().min(1).max(600),
});

export const clarifyIntentSchema = z.object({
  kind: z.literal('clarify'),
  question: z.string().min(1).max(200),
});

export const declineIntentSchema = z.object({
  kind: z.literal('decline'),
  reason: z.string().min(1).max(200),
});

/**
 * Discriminated union of all actionable host intent classifications.
 * WHY: Maps free-form natural language instructions into typed engine operations.
 */
export const intentOutputSchema = z.discriminatedUnion('kind', [
  changeGuestCountIntentSchema,
  changeBudgetIntentSchema,
  adjustCategoryIntentSchema,
  upgradeIntentSchema,
  downgradeIntentSchema,
  saveMoneyIntentSchema,
  affordCheckIntentSchema,
  findForgottenIntentSchema,
  makeItPremiumIntentSchema,
  simulateIntentSchema,
  selectConceptIntentSchema,
  combineConceptsIntentSchema,
  addPreferenceIntentSchema,
  setSettingIntentSchema,
  setDateIntentSchema,
  answerIntentSchema,
  clarifyIntentSchema,
  declineIntentSchema,
]);

export type IntentOutput = z.infer<typeof intentOutputSchema>;
export type IntentKind = IntentOutput['kind'];

export type ChangeGuestCountIntent = z.infer<typeof changeGuestCountIntentSchema>;
export type ChangeBudgetIntent = z.infer<typeof changeBudgetIntentSchema>;
export type AdjustCategoryIntent = z.infer<typeof adjustCategoryIntentSchema>;
export type UpgradeIntent = z.infer<typeof upgradeIntentSchema>;
export type DowngradeIntent = z.infer<typeof downgradeIntentSchema>;
export type SaveMoneyIntent = z.infer<typeof saveMoneyIntentSchema>;
export type AffordCheckIntent = z.infer<typeof affordCheckIntentSchema>;
export type FindForgottenIntent = z.infer<typeof findForgottenIntentSchema>;
export type MakeItPremiumIntent = z.infer<typeof makeItPremiumIntentSchema>;
export type SimulateIntent = z.infer<typeof simulateIntentSchema>;
export type SelectConceptIntent = z.infer<typeof selectConceptIntentSchema>;
export type CombineConceptsIntent = z.infer<typeof combineConceptsIntentSchema>;
export type AddPreferenceIntent = z.infer<typeof addPreferenceIntentSchema>;
export type SetSettingIntent = z.infer<typeof setSettingIntentSchema>;
export type SetDateIntent = z.infer<typeof setDateIntentSchema>;
export type AnswerIntent = z.infer<typeof answerIntentSchema>;
export type ClarifyIntent = z.infer<typeof clarifyIntentSchema>;
export type DeclineIntent = z.infer<typeof declineIntentSchema>;
