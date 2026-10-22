import { eventPlanSchema } from '@/domain/schemas';
import type { Concept, EventPlan } from '@/domain/types';
import type { AssistantOutcome } from '@/engine/assistant/types';
import type { FitReport } from '@/engine/planFactory';
import type { MissingInfoItem } from '@/llm/schemas/intake';
import { narrateInputSchema, type NarrateInput } from '@/llm/schemas/narrate';
import { z } from 'zod';

export const intakeRequestSchema = z.object({
  text: z.string().min(1).max(1500),
});

export type IntakeRequest = z.infer<typeof intakeRequestSchema>;

export const messageRoleSchema = z.enum(['user', 'assistant']);

export const recentMessageSchema = z.object({
  role: messageRoleSchema,
  text: z.string().min(1).max(300),
});

export const messageRequestSchema = z.object({
  message: z.string().min(1).max(500),
  plan: eventPlanSchema,
  recentMessages: z.array(recentMessageSchema).max(6).default([]),
});

export type MessageRequest = z.infer<typeof messageRequestSchema>;

export const conceptsRequestSchema = z.object({
  plan: eventPlanSchema,
});

export type ConceptsRequest = z.infer<typeof conceptsRequestSchema>;

export interface ConceptsResponse {
  concepts: Concept[];
  degraded: boolean;
  notes: string[];
}

export const narrateRequestSchema = narrateInputSchema;
export type NarrateRequest = NarrateInput;

export interface HealthResponse {
  mode: 'live' | 'demo';
  note?: string;
}

export interface IntakeResponse {
  plan: EventPlan;
  fit: FitReport;
  assumptions: string[];
  missingInfo: MissingInfoItem[];
  mode: 'live' | 'demo';
  degraded: boolean;
  notes: string[];
}

export interface MessageResponse {
  outcome: AssistantOutcome;
  mode: 'live' | 'demo';
  degraded: boolean;
  notes: string[];
  narration?: {
    text: string;
    highlights: string[];
  };
}

export interface NarrateResponse {
  text: string;
  highlights: string[];
  degraded: boolean;
}

export type ApiErrorCode =
  | 'invalid_request'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'forbidden_origin'
  | 'rate_limited'
  | 'ai_unavailable'
  | 'internal';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}
