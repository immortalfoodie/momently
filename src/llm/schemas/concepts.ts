import { qualityLevelSchema } from '@/domain/schemas';
import { planSummarySchema } from '@/llm/context';
import { intakeOutputSchema } from '@/llm/schemas/intake';
import { z } from 'zod';

/**
 * Validated concepts generation task input.
 * WHY: Provides structured intake brief and distilled plan context with allowed rate families.
 */
export const conceptsInputSchema = z.object({
  brief: intakeOutputSchema,
  planSummary: planSummarySchema,
});

export type ConceptsInput = z.infer<typeof conceptsInputSchema>;

/**
 * Individual creative celebration concept proposal schema.
 * WHY: Balances aesthetic personality with structured quality profile tiers for deterministic pricing.
 */
export const conceptProposalSchema = z.object({
  title: z.string().min(1).max(100),
  tagline: z.string().min(1).max(140),
  summary: z.string().min(1).max(500),
  palette: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
    .min(3)
    .max(5),
  experienceHighlights: z.array(z.string().min(1)).min(3).max(6),
  qualityProfile: z.record(z.string(), qualityLevelSchema),
  tradeoffs: z.array(z.string().min(1)).min(1).max(4),
  whyItFits: z.string().min(1).max(500),
  tags: z.array(z.string().min(1)).max(5),
});

export type ConceptProposal = z.infer<typeof conceptProposalSchema>;

/**
 * Concepts task output: exactly three differentiated concept proposals.
 * WHY: Presenting 3 distinct options (budget-lean, balanced, premium/experience-led) maximizes host choice.
 */
export const conceptsOutputSchema = z.object({
  concepts: z.array(conceptProposalSchema).length(3),
});

export type ConceptsOutput = z.infer<typeof conceptsOutputSchema>;
