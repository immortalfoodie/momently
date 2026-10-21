import { z } from 'zod';
import { BUDGET_CATEGORY_IDS, EVENT_TYPE_IDS, SCHEDULE_PRIORITIES } from './constants';

export const moneySchema = z.number().int().nonnegative();

export const provenanceSchema = z.enum(['user', 'estimate', 'verified']);

export const budgetCategorySchema = z.enum(BUDGET_CATEGORY_IDS);

export const budgetItemSchema = z.object({
  id: z.string().min(1),
  category: budgetCategorySchema,
  label: z.string().min(1).max(80),
  basis: z.enum(['per_guest', 'flat']),
  unitCost: moneySchema,
  quantity: z.number().int().min(1),
  provenance: provenanceSchema,
  locked: z.boolean(),
  note: z.string().max(200).optional(),
  rateKey: z.string().max(60).optional(),
});

export const constraintKindSchema = z.enum([
  'budget_cap',
  'guest_count',
  'date',
  'venue',
  'dietary',
  'accessibility',
  'must_have',
  'avoid',
  'style',
]);

export const constraintSeveritySchema = z.enum(['hard', 'soft']);

export const constraintSchema = z.object({
  id: z.string().min(1),
  kind: constraintKindSchema,
  severity: constraintSeveritySchema,
  description: z.string().min(1).max(200),
  numericValue: z.number().optional(),
  textValue: z.string().optional(),
});

export const guestNeedsSchema = z
  .object({
    vegetarian: z.number().int().min(0),
    jain: z.number().int().min(0),
    vegan: z.number().int().min(0),
    glutenFree: z.number().int().min(0),
    allergyAlerts: z.number().int().min(0),
    wheelchairUsers: z.number().int().min(0),
    elderly: z.number().int().min(0),
    children: z.number().int().min(0),
    quietSpaceNeeded: z.boolean(),
    languages: z.array(z.string().min(1).max(30)).max(5),
  })
  .strict();

export const QUALITY_ORDER = ['essential', 'standard', 'premium'] as const;
export const qualityLevelSchema = z.enum(QUALITY_ORDER);
export type QualityLevel = z.infer<typeof qualityLevelSchema>;

export const conceptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  tagline: z.string().min(1).max(140),
  summary: z.string().min(1).max(500),
  palette: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
    .min(3)
    .max(5),
  experienceHighlights: z.array(z.string().min(1)).min(3).max(6),
  estimatedTotal: moneySchema,
  tradeoffs: z.array(z.string().min(1)).min(1).max(4),
  whyItFits: z.string().min(1),
  tags: z.array(z.string().min(1)).max(5),
  qualityProfile: z.record(z.string(), qualityLevelSchema).optional(),
});

export const schedulePrioritySchema = z.enum(SCHEDULE_PRIORITIES);

export const scheduleSlotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(5).max(720),
  priority: schedulePrioritySchema,
  flexible: z.boolean(),
  minDurationMinutes: z.number().int().min(5).max(720).optional(),
  note: z.string().max(200).optional(),
});

export const taskStatusSchema = z.enum(['todo', 'doing', 'done']);
export const taskPrioritySchema = z.enum(['high', 'medium', 'low']);

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(50),
  dueDaysBefore: z.number().int().min(0),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  notes: z.string().max(300).optional(),
});

export const vendorQuoteSchema = z.object({
  vendorName: z.string().min(1).max(100),
  price: moneySchema,
  answers: z.record(z.string(), z.string()),
});

export const vendorNeedStatusSchema = z.enum(['not_started', 'comparing', 'booked']);

export const vendorNeedSchema = z.object({
  id: z.string().min(1),
  category: budgetCategorySchema,
  requirements: z.array(z.string().min(1)),
  questionsToAsk: z.array(z.string().min(1)),
  quotes: z.array(vendorQuoteSchema),
  status: vendorNeedStatusSchema,
});

export const riskSeveritySchema = z.enum(['low', 'medium', 'high']);

export const riskSchema = z.object({
  id: z.string().min(1),
  severity: riskSeveritySchema,
  title: z.string().min(1).max(100),
  explanation: z.string().min(1).max(500),
  mitigation: z.string().min(1).max(500),
});

export const eventTypeSchema = z.enum(EVENT_TYPE_IDS);
export const eventSettingSchema = z.enum(['indoor', 'outdoor', 'mixed', 'undecided']);

export const eventMetaSchema = z.object({
  title: z.string().min(1).max(120),
  type: eventTypeSchema,
  city: z.string().min(1).max(100),
  dateIso: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .optional(),
  guestCount: z.number().int().min(1).max(5000),
  setting: eventSettingSchema,
  hostBrief: z.string().max(1000),
  startMinute: z.number().int().min(0).max(1439).optional(),
});

export const decisionSourceSchema = z.enum(['user', 'ai', 'chaos', 'system']);
export const decisionStatusSchema = z.enum([
  'locked',
  'proposed',
  'approved',
  'rejected',
]);

export const decisionRecordSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(10),
  summary: z.string().min(1).max(300),
  source: decisionSourceSchema,
  status: decisionStatusSchema,
});

export const eventPlanSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  meta: eventMetaSchema,
  constraints: z.array(constraintSchema),
  concepts: z.array(conceptSchema),
  selectedConceptId: z.string().nullable(),
  budgetItems: z.array(budgetItemSchema),
  schedule: z.array(scheduleSlotSchema),
  tasks: z.array(taskSchema),
  vendors: z.array(vendorNeedSchema),
  guestNeeds: guestNeedsSchema,
  ledger: z.array(decisionRecordSchema),
});
