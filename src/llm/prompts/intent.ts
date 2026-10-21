import { intentOutputSchema, type IntentInput } from '@/llm/schemas/intent';
import { sanitizeUserText, wrapUntrusted } from '@/llm/sanitize';
import { SHARED_RULES } from './shared';
import type { PromptPayload } from './intake';
import { z } from 'zod';

/**
 * Builds system and user prompts for intent classification.
 * WHY: Maps conversational host inquiries deterministically to typed engine operations or guidance.
 */
export function buildIntentPrompt(input: IntentInput): PromptPayload {
  const sanitized = sanitizeUserText(input.message, 500);
  const wrappedMessage = wrapUntrusted(sanitized.text);

  const jsonSchema = JSON.stringify(z.toJSONSchema(intentOutputSchema));

  const system = `${SHARED_RULES}

Task: Host Intent Classification
The user's message is a request or question regarding the CURRENT active event plan.
Map the message to the SINGLE closest intent kind in the discriminated union schema:
${jsonSchema}

Classification Rules & Keyword Mappings:
1. "decor" or "decoration" -> rate family 'decor_theme'.
2. "photographer" or "photos" or "videographer" -> rate family 'photo_video'.
3. "singer", "band", "dj", or "live music" -> rate family 'entertainment_music'.
4. "food" or "catering" -> rate family 'catering_buffet' (or 'catering_snacks' if snacks are in allowedFamilies).
5. Relative guest changes (e.g. "20 more guests", "5 fewer people") MUST be converted into the absolute new count using current guestCount (${input.planSummary.meta.guestCount}).
6. Budget modifications:
   - "save ₹15,000" -> 'save_money' { amount: 15000 }.
   - If lower budget without an exact number ("make it 20% cheaper" or "lower budget") -> return 'clarify' asking how much to lower, unless it relates to concept combination.
7. Concept combination:
   - "combine decorations from option 2 with the atmosphere of option 1 but 20% cheaper" -> 'combine_concepts' { baseRef: "1", borrowRef: "2", borrowCategories: ["decor"], percentCheaper: 20 }.
8. Crisis / What-if simulations:
   - "what if it rains" -> 'simulate' { scenario: { type: "rain" } }.
   - "budget drops by 20%" -> 'simulate' { scenario: { type: "budget_cut", percent: 20 } }.
   - "photographer cancelled" -> 'simulate' { scenario: { type: "vendor_cancels", category: "photography" } }.
   - "starts two hours late" -> 'simulate' { scenario: { type: "late_start", delayMinutes: 120 } }.
   - "cake unavailable" -> 'simulate' { scenario: { type: "item_unavailable", family: "catering_snacks" } }.
9. Preferences:
   - "must be wheelchair accessible" -> 'add_preference' { preferenceKind: "accessibility", description: "Wheelchair accessibility required", severity: "hard" }.
   - "my cousin is Jain" -> 'add_preference' { preferenceKind: "dietary", description: "Jain catering options required", severity: "hard" }.
10. Ambiguous or general planning queries:
    - If ambiguous, return 'clarify' { question: "..." }.
    - If planning advice without plan state change, return 'answer' { reply: "..." } (planning advice only, NO hallucinated prices!).
    - If impossible or out of scope, return 'decline' { reason: "..." }.

Worked Example:
User Message: "Increase guests from 80 to 110"
Output:
{
  "kind": "change_guest_count",
  "guestCount": 110
}`;

  const recentHistory =
    input.recentMessages.length > 0
      ? `Recent Conversation:\n${input.recentMessages.map((m) => `${m.role}: ${m.text}`).join('\n')}\n\n`
      : '';

  const user = `${recentHistory}Active Plan Summary:
Event Type: ${input.planSummary.meta.type}
Guest Count: ${input.planSummary.meta.guestCount}
Budget Cap: ${input.planSummary.budgetStatus.cap ?? 'None'}
Total Budget: ${input.planSummary.budgetStatus.total}

User Message:
${wrappedMessage}

Classify into single JSON intent:`;

  return { system, user };
}
