import { z } from 'zod';
import {
  budgetCategorySchema,
  budgetItemSchema,
  constraintSchema,
  eventMetaSchema,
  eventSettingSchema,
  moneySchema,
  scheduleSlotSchema,
  taskSchema,
} from './baseSchemas';

export const planPatchOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_guest_count'),
    guestCount: z.number().int().min(1).max(5000),
  }),
  z.object({
    type: z.literal('set_budget_cap'),
    amount: moneySchema,
  }),
  z.object({
    type: z.literal('scale_category'),
    category: budgetCategorySchema,
    percent: z.number().int().min(-90).max(200),
  }),
  z.object({
    type: z.literal('add_budget_item'),
    item: budgetItemSchema,
  }),
  z.object({
    type: z.literal('update_budget_item'),
    id: z.string().min(1),
    changes: budgetItemSchema.omit({ id: true }).partial(),
  }),
  z.object({
    type: z.literal('remove_budget_item'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('select_concept'),
    conceptId: z.string().min(1).nullable(),
  }),
  z.object({
    type: z.literal('set_setting'),
    setting: eventSettingSchema,
  }),
  z.object({
    type: z.literal('add_constraint'),
    constraint: constraintSchema,
  }),
  z.object({
    type: z.literal('remove_constraint'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('add_slot'),
    slot: scheduleSlotSchema,
  }),
  z.object({
    type: z.literal('update_slot'),
    id: z.string().min(1),
    changes: scheduleSlotSchema.omit({ id: true }).partial(),
  }),
  z.object({
    type: z.literal('remove_slot'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('shift_schedule'),
    fromMinute: z.number().int().min(0).max(1439),
    deltaMinutes: z.number().int().min(-240).max(240),
  }),
  z.object({
    type: z.literal('add_task'),
    task: taskSchema,
  }),
  z.object({
    type: z.literal('update_task'),
    id: z.string().min(1),
    changes: taskSchema.omit({ id: true }).partial(),
  }),
  z.object({
    type: z.literal('remove_task'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('set_meta'),
    changes: eventMetaSchema.partial(),
  }),
]);

export const planPatchSchema = z.object({
  id: z.string().min(1),
  ops: z.array(planPatchOpSchema).min(1).max(30),
  reason: z.string().min(1).max(300),
  source: z.enum(['user', 'ai', 'chaos']),
  status: z.enum(['proposed', 'approved', 'rejected', 'applied']),
  createdAt: z.string(),
});

export const planImpactSchema = z.object({
  budgetTotalBefore: moneySchema,
  budgetTotalAfter: moneySchema,
  budgetCap: moneySchema.nullable(),
  overCap: z.boolean(),
  changedItems: z.array(
    z.object({
      label: z.string(),
      before: moneySchema,
      after: moneySchema,
    }),
  ),
  notes: z.array(z.string()),
});
