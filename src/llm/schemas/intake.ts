import { eventSettingSchema, eventTypeSchema, guestNeedsSchema } from '@/domain/schemas';
import { z } from 'zod';

/**
 * Validated intake input parameters.
 * WHY: Bounds raw text and injects reference date for resolving relative dates ("next Friday").
 */
export const intakeInputSchema = z.object({
  text: z.string().min(1).max(1500),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type IntakeInput = z.infer<typeof intakeInputSchema>;

/**
 * Constraint kinds permissible in the intake proposal.
 * WHY: budget_cap and guest_count are handled exclusively by deterministic engine fields.
 */
export const intakeConstraintKindSchema = z.enum([
  'must_have',
  'avoid',
  'style',
  'dietary',
  'accessibility',
  'venue',
  'date',
]);

export const intakeConstraintSchema = z.object({
  kind: intakeConstraintKindSchema,
  description: z.string().min(1).max(200),
  severity: z.enum(['hard', 'soft']),
});

export type IntakeConstraint = z.infer<typeof intakeConstraintSchema>;

export const missingInfoFieldSchema = z.enum([
  'city',
  'guestCount',
  'budget',
  'date',
  'type',
]);

export const missingInfoItemSchema = z.object({
  field: missingInfoFieldSchema,
  question: z.string().min(1).max(160),
});

export type MissingInfoItem = z.infer<typeof missingInfoItemSchema>;

/**
 * Validated structured intake extraction proposal.
 * WHY: Enforces strict typing from conversational briefs into plan initialization parameters.
 */
export const intakeOutputSchema = z.object({
  title: z.string().min(1).max(80),
  type: eventTypeSchema,
  city: z.string().min(1).max(60).nullable(),
  dateIso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  guestCount: z.number().int().min(1).max(5000).nullable(),
  setting: eventSettingSchema.nullable(),
  budgetCap: z.number().int().nonnegative().nullable(),
  budgetIsHard: z.boolean(),
  constraints: z.array(intakeConstraintSchema).max(12),
  guestNeeds: guestNeedsSchema.partial(),
  styleTags: z.array(z.string().min(1).max(40)).max(6),
  missingInfo: z.array(missingInfoItemSchema).max(4),
});

export type IntakeOutput = z.infer<typeof intakeOutputSchema>;
