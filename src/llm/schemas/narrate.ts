import { z } from 'zod';

export const narratePurposeSchema = z.enum([
  'chat_reply',
  'chaos_summary',
  'budget_explainer',
  'change_summary',
]);

export type NarratePurpose = z.infer<typeof narratePurposeSchema>;

export const factValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export type FactValue = z.infer<typeof factValueSchema>;

/**
 * Validated narrate task input.
 * WHY: Bounds structured facts passed to the LLM to prevent unbounded token usage and maintain strict factual grounding.
 */
export const narrateInputSchema = z.object({
  purpose: narratePurposeSchema,
  facts: z
    .record(z.string(), factValueSchema)
    .refine(
      (rec) => Object.keys(rec).length <= 30,
      'Facts record must not exceed 30 keys',
    ),
});

export type NarrateInput = z.infer<typeof narrateInputSchema>;

/**
 * Validated narrate task output.
 * WHY: Enforces bounded, human-friendly narrative summaries and executive highlight callouts.
 */
export const narrateOutputSchema = z.object({
  text: z.string().min(1).max(700),
  highlights: z.array(z.string().min(1).max(120)).max(4),
});

export type NarrateOutput = z.infer<typeof narrateOutputSchema>;
