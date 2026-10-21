import {
  budgetCategorySchema,
  eventSettingSchema,
  eventTypeSchema,
  moneySchema,
  provenanceSchema,
  qualityLevelSchema,
  schedulePrioritySchema,
  vendorNeedStatusSchema,
} from '@/domain/schemas';
import { z } from 'zod';

export const planSummaryMetaSchema = z.object({
  title: z.string(),
  type: eventTypeSchema,
  city: z.string(),
  dateIso: z.string().optional(),
  guestCount: z.number().int(),
  setting: eventSettingSchema,
  hostBrief: z.string().max(300),
});

export const planSummaryConceptSchema = z.object({
  index: z.number().int().min(1).max(3),
  title: z.string(),
  qualityProfile: z.record(z.string(), qualityLevelSchema),
});

export const planSummaryBudgetItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: budgetCategorySchema,
  family: z.string(),
  quality: qualityLevelSchema.nullable(),
  total: moneySchema,
  provenance: provenanceSchema,
  locked: z.boolean(),
});

export const planSummaryBudgetStatusSchema = z.object({
  cap: moneySchema.nullable(),
  total: moneySchema,
  remaining: z.number().int().nullable(),
  overCap: z.boolean(),
});

export const planSummaryScheduleSlotSchema = z.object({
  id: z.string(),
  title: z.string(),
  startMinute: z.number().int(),
  durationMinutes: z.number().int(),
  priority: schedulePrioritySchema,
});

export const planSummaryVendorSchema = z.object({
  category: budgetCategorySchema,
  status: vendorNeedStatusSchema,
});

export const planSummaryGuestNeedsSchema = z.object({
  vegetarian: z.number().int(),
  jain: z.number().int(),
  vegan: z.number().int(),
  glutenFree: z.number().int(),
  allergyAlerts: z.number().int(),
  wheelchairUsers: z.number().int(),
  elderly: z.number().int(),
  children: z.number().int(),
  quietSpaceNeeded: z.boolean(),
  languages: z.array(z.string()),
});

export const planSummarySchema = z.object({
  meta: planSummaryMetaSchema,
  hardConstraints: z.array(z.string()),
  softConstraints: z.array(z.string()),
  concepts: z.array(planSummaryConceptSchema),
  selectedConceptId: z.string().nullable(),
  budgetItems: z.array(planSummaryBudgetItemSchema),
  totalsByCategory: z.record(z.string(), moneySchema),
  budgetStatus: planSummaryBudgetStatusSchema,
  schedule: z.array(planSummaryScheduleSlotSchema),
  vendors: z.array(planSummaryVendorSchema),
  guestNeeds: planSummaryGuestNeedsSchema,
  allowedFamilies: z.array(z.string()),
  allowedCategories: z.array(z.string()),
  truncated: z.boolean(),
});

export type PlanSummary = z.infer<typeof planSummarySchema>;
