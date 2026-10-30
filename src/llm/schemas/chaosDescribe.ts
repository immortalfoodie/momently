import { z } from 'zod';
import { eventSettingSchema } from '@/domain/baseSchemas';
import { chaosScenarioInputSchema } from '@/domain/chaosSchemas';

/** Maximum characters accepted for a free-text disaster description. */
export const CHAOS_DESCRIBE_MAX_CHARS = 500;

/** Maximum number of scenarios a single description may map to. */
export const CHAOS_DESCRIBE_MAX_SCENARIOS = 3;

/**
 * Validated chaos_describe task input.
 * WHY: The LLM only sees the vocabulary it may choose from (vendor categories, item families),
 * never the full plan, so it cannot invent categories and the request stays small.
 */
export const chaosDescribeInputSchema = z.object({
  text: z.string().min(1).max(CHAOS_DESCRIBE_MAX_CHARS),
  vendorCategories: z.array(z.string().min(1).max(60)).max(20),
  itemFamilies: z
    .array(z.object({ family: z.string().min(1).max(60), label: z.string().min(1).max(80) }))
    .max(30),
  setting: eventSettingSchema,
  guestCount: z.number().int().min(1).max(5000),
});

export type ChaosDescribeInput = z.infer<typeof chaosDescribeInputSchema>;

/**
 * Validated chaos_describe task output.
 * WHY: Reuses the engine's own scenario schema so every mapped scenario is immediately simulatable;
 * `unsupported` lets the model say honestly what it could not map instead of guessing.
 */
export const chaosDescribeOutputSchema = z.object({
  scenarios: z.array(chaosScenarioInputSchema).max(CHAOS_DESCRIBE_MAX_SCENARIOS),
  understood: z.string().min(1).max(300),
  unsupported: z.string().max(200).nullable().optional(),
});

export type ChaosDescribeOutput = z.infer<typeof chaosDescribeOutputSchema>;
