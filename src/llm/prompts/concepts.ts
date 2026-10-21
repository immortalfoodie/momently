import { conceptsOutputSchema, type ConceptsInput } from '@/llm/schemas/concepts';
import { SHARED_RULES } from './shared';
import type { PromptPayload } from './intake';
import { z } from 'zod';

/**
 * Builds system and user prompts for generating 3 differentiated celebration concepts.
 * WHY: Forces genuine creative variety (spend pattern, mood, signature moments) bound to rate-card families.
 */
export function buildConceptsPrompt(input: ConceptsInput): PromptPayload {
  const jsonSchema = JSON.stringify(z.toJSONSchema(conceptsOutputSchema));

  const allowedFamiliesStr = input.planSummary.allowedFamilies.join(', ');

  const system = `${SHARED_RULES}

Task: Celebration Concepts Generation
Generate THREE GENUINELY DIFFERENT concepts (different mood, spend pattern, and signature moment) tailored to the host brief.
Output a JSON object matching this schema:
${jsonSchema}

Concept Differentiation Rules:
1. Concept 1 (Value/Intimate): Budget-friendly, high emotional warmth, lean spend on decor/sound, focused on personal moments.
2. Concept 2 (Balanced/Classic): Balanced investment across catering, decor, and entertainment, delivering timeless celebration standards.
3. Concept 3 (Signature/Experience-led): Premium signature experiences in 1 or 2 focal areas (e.g. decor or photography) balanced by prudent essentials elsewhere.

QualityProfile Invariant:
- You may ONLY use the allowed service families for this event type: [${allowedFamiliesStr}].
- For each family in the profile, assign a quality tier: 'essential' | 'standard' | 'premium'.
- Palette must contain 3 to 5 valid hex color codes (e.g. #8B0000).
- Experience highlights: 3 to 6 unique memorable moments.
- Tradeoffs: 1 to 4 explicit compromises (e.g., standard floral decor to afford live acoustic music).`;

  const user = `Host Brief Summary:
${JSON.stringify(input.brief, null, 2)}

Active Plan Context:
Event Type: ${input.planSummary.meta.type}
City: ${input.planSummary.meta.city}
Guest Count: ${input.planSummary.meta.guestCount}
Budget Cap: ${input.planSummary.budgetStatus.cap ?? 'Unspecified'}
Allowed Rate Families: [${allowedFamiliesStr}]

Generate the 3 distinct concepts:`;

  return { system, user };
}
