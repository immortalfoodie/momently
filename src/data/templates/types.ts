import { z } from 'zod';
import { BUDGET_CATEGORY_IDS } from '@/domain/constants';
import {
  budgetCategorySchema,
  eventTypeSchema,
  schedulePrioritySchema,
  taskPrioritySchema,
} from '@/domain/schemas';

export const scheduleBlueprintSchema = z.object({
  title: z.string().min(1),
  offsetMinutes: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(5).max(720),
  priority: schedulePrioritySchema,
  flexible: z.boolean(),
  minDurationMinutes: z.number().int().min(5).max(720).optional(),
  note: z.string().max(200).optional(),
});

export type ScheduleBlueprint = z.infer<typeof scheduleBlueprintSchema>;

export const templateTaskSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(50),
  dueDaysBefore: z.number().int().min(0),
  priority: taskPrioritySchema,
});

export type TemplateTask = z.infer<typeof templateTaskSchema>;

export const templateVendorSchema = z.object({
  category: budgetCategorySchema,
  requirements: z.array(z.string().min(1)).min(4).max(7),
  questionsToAsk: z.array(z.string().min(1)).min(5).max(8),
});

export type TemplateVendor = z.infer<typeof templateVendorSchema>;

export const templateLineItemSchema = z.object({
  family: z.string().min(1),
  required: z.boolean(),
});

export type TemplateLineItem = z.infer<typeof templateLineItemSchema>;

export const eventTemplateSchema = z.object({
  type: eventTypeSchema,
  label: z.string().min(1),
  lineItems: z.array(templateLineItemSchema).min(1),
  categoryMultipliers: z
    .record(z.string(), z.number().positive())
    .refine(
      (rec) =>
        Object.keys(rec).every((key) =>
          (BUDGET_CATEGORY_IDS as readonly string[]).includes(key),
        ),
      { message: 'Keys must be valid budget categories' },
    )
    .optional(),
  downgradeOrder: z.array(z.string().min(1)),
  contingencyBasePercent: z.number().int().min(0).max(50),
  defaultStartMinute: z.number().int().min(0).max(1439),
  schedule: z.array(scheduleBlueprintSchema).min(1),
  tasks: z.array(templateTaskSchema).min(1),
  vendors: z.array(templateVendorSchema).min(1),
  styleSuggestions: z.array(z.string().min(1)).min(3).max(6),
});

export type EventTemplate = z.infer<typeof eventTemplateSchema>;
