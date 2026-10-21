import type { z } from 'zod';
import type {
  budgetCategorySchema,
  budgetItemSchema,
  conceptSchema,
  constraintKindSchema,
  constraintSchema,
  constraintSeveritySchema,
  decisionRecordSchema,
  decisionSourceSchema,
  decisionStatusSchema,
  eventMetaSchema,
  eventPlanSchema,
  eventSettingSchema,
  eventTypeSchema,
  guestNeedsSchema,
  moneySchema,
  planImpactSchema,
  planPatchOpSchema,
  planPatchSchema,
  provenanceSchema,
  riskSchema,
  riskSeveritySchema,
  schedulePrioritySchema,
  scheduleSlotSchema,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
  vendorNeedSchema,
  vendorNeedStatusSchema,
  vendorQuoteSchema,
} from './schemas';

export type { QualityLevel } from './schemas';
export type Money = z.infer<typeof moneySchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type BudgetCategory = z.infer<typeof budgetCategorySchema>;
export type BudgetItem = z.infer<typeof budgetItemSchema>;
export type ConstraintKind = z.infer<typeof constraintKindSchema>;
export type ConstraintSeverity = z.infer<typeof constraintSeveritySchema>;
export type Constraint = z.infer<typeof constraintSchema>;
export type GuestNeeds = z.infer<typeof guestNeedsSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type SchedulePriority = z.infer<typeof schedulePrioritySchema>;
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type Task = z.infer<typeof taskSchema>;
export type VendorQuote = z.infer<typeof vendorQuoteSchema>;
export type VendorNeedStatus = z.infer<typeof vendorNeedStatusSchema>;
export type VendorNeed = z.infer<typeof vendorNeedSchema>;
export type RiskSeverity = z.infer<typeof riskSeveritySchema>;
export type Risk = z.infer<typeof riskSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type EventSetting = z.infer<typeof eventSettingSchema>;
export type EventMeta = z.infer<typeof eventMetaSchema>;
export type DecisionSource = z.infer<typeof decisionSourceSchema>;
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;
export type DecisionRecord = z.infer<typeof decisionRecordSchema>;
export type EventPlan = z.infer<typeof eventPlanSchema>;
export type PlanPatchOp = z.infer<typeof planPatchOpSchema>;
export type PlanPatch = z.infer<typeof planPatchSchema>;
export type PlanImpact = z.infer<typeof planImpactSchema>;

export type { CityTier } from './constants';
