import type { LlmTaskName } from './types';
import {
  intakeInputSchema,
  intakeOutputSchema,
  conceptsInputSchema,
  conceptsOutputSchema,
  intentInputSchema,
  intentOutputSchema,
  narrateInputSchema,
  narrateOutputSchema,
} from './schemas/index';
import {
  buildIntakePrompt,
  buildConceptsPrompt,
  buildIntentPrompt,
  buildNarratePrompt,
} from './prompts/index';
import type { z } from 'zod';

export interface TaskDefinition<TInput, TOutput> {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  build: (input: TInput) => { system: string; user: string };
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

/**
 * Strongly typed registry of all supported Momently LLM tasks with their respective schemas,
 * prompt builders, and execution hyperparameters.
 * WHY: Provides compile-time type safety so runTask can automatically infer exact input and output types.
 */
export const LLM_TASKS = {
  intake: {
    inputSchema: intakeInputSchema,
    outputSchema: intakeOutputSchema,
    build: buildIntakePrompt,
    temperature: 0.1,
    maxOutputTokens: 2048,
    timeoutMs: 15000,
  },
  concepts: {
    inputSchema: conceptsInputSchema,
    outputSchema: conceptsOutputSchema,
    build: buildConceptsPrompt,
    temperature: 0.7,
    maxOutputTokens: 3000,
    timeoutMs: 20000,
  },
  intent: {
    inputSchema: intentInputSchema,
    outputSchema: intentOutputSchema,
    build: buildIntentPrompt,
    temperature: 0.1,
    maxOutputTokens: 1024,
    timeoutMs: 10000,
  },
  narrate: {
    inputSchema: narrateInputSchema,
    outputSchema: narrateOutputSchema,
    build: buildNarratePrompt,
    temperature: 0.4,
    maxOutputTokens: 1024,
    timeoutMs: 10000,
  },
} as const;

export type LlmTaskRegistry = typeof LLM_TASKS;
export type TaskInput<T extends LlmTaskName> = z.infer<LlmTaskRegistry[T]['inputSchema']>;
export type TaskOutput<T extends LlmTaskName> = z.infer<LlmTaskRegistry[T]['outputSchema']>;
