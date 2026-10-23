import { contactSchema, type Contact } from '@/domain/contactSchemas';
import { eventPlanSchema } from '@/domain/schemas';
import type { EventPlan } from '@/domain/types';
import type { PlanSnapshot } from '@/engine/history';
import { missingInfoItemSchema, type MissingInfoItem } from '@/llm/schemas/intake';
import { z } from 'zod';

export const chatMessageRoleSchema = z.enum(['user', 'assistant']);
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: chatMessageRoleSchema,
  text: z.string().min(1).max(2000),
  createdAt: z.string(),
  outcomeKind: z.string().optional(),
  basedOnVersion: z.number().int().positive().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const planSnapshotSchema = z.object({
  version: z.number().int().positive(),
  savedAt: z.string(),
  label: z.string(),
  plan: eventPlanSchema,
});

export const eventRecordSchema = z.object({
  plan: eventPlanSchema,
  history: z.array(planSnapshotSchema).max(25).default([]),
  messages: z.array(chatMessageSchema).max(60).default([]),
  assumptions: z.array(z.string()).max(10).default([]),
  missingInfo: z.array(missingInfoItemSchema).max(4).default([]),
  contacts: z.array(contactSchema).max(30).default([]),
});

export interface EventRecord {
  plan: EventPlan;
  history: PlanSnapshot[];
  messages: ChatMessage[];
  assumptions: string[];
  missingInfo: MissingInfoItem[];
  contacts: Contact[];
}

export const persistedStateSchema = z.object({
  events: z.record(z.string(), eventRecordSchema),
  order: z.array(z.string()),
});

export type PersistedState = z.infer<typeof persistedStateSchema>;
