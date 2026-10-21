import { narrateOutputSchema, type NarrateInput } from '@/llm/schemas/narrate';
import { SHARED_RULES } from './shared';
import type { PromptPayload } from './intake';
import { z } from 'zod';

/**
 * Builds system and user prompts for narrative generation.
 * WHY: Grounded text synthesis strictly bound to engine facts with no hallucinated math or vendor claims.
 */
export function buildNarratePrompt(input: NarrateInput): PromptPayload {
  const jsonSchema = JSON.stringify(z.toJSONSchema(narrateOutputSchema));

  const system = `${SHARED_RULES}

Task: Event Narrative Synthesis
Synthesize a short, warm, and natural narrative summary explaining event facts to the host.
Output a JSON object matching this schema:
${jsonSchema}

Factual Grounding Invariants:
1. Use ONLY the facts provided in the input.
2. DO NOT introduce any number, rupee amount, percentage, date, or person name that is not explicitly present in the facts.
3. NEVER promise or suggest that the app or platform will contact, negotiate with, or book vendors.
4. Keep the text warm, reassuring, concise (max 700 characters), and plain.
5. Provide up to 4 highlights (each max 120 chars) calling out key takeaways.`;

  const user = `Purpose: ${input.purpose}

Verified Facts:
${JSON.stringify(input.facts, null, 2)}

Generate narrative JSON:`;

  return { system, user };
}
