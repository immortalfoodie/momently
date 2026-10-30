import {
  CHAOS_DESCRIBE_MAX_CHARS,
  chaosDescribeOutputSchema,
  type ChaosDescribeInput,
} from '@/llm/schemas/chaosDescribe';
import { sanitizeUserText, wrapUntrusted } from '@/llm/sanitize';
import { SHARED_RULES } from './shared';
import type { PromptPayload } from './intake';
import { z } from 'zod';

/**
 * Builds system and user prompts that map a host's free-text disaster into engine scenarios.
 * WHY: The model only translates words into typed scenarios; the engine simulates and prices them.
 */
export function buildChaosDescribePrompt(input: ChaosDescribeInput): PromptPayload {
  const sanitized = sanitizeUserText(input.text, CHAOS_DESCRIBE_MAX_CHARS);
  const jsonSchema = JSON.stringify(z.toJSONSchema(chaosDescribeOutputSchema));

  const system = `${SHARED_RULES}

Task: Disaster Description Mapping
The host describes something that could go wrong at their event. Map it to at most 3 scenarios
from this schema:
${jsonSchema}

Mapping Rules:
1. rain, storm, monsoon, downpour, "baarish" -> { "type": "rain" }. Only if the setting is not indoor.
2. A vendor cancelling, backing out or not showing up -> { "type": "vendor_cancels", "category": <one of vendorCategories> }.
   The category MUST be copied exactly from vendorCategories. If none fits, do not emit it.
3. A delay, traffic, late start or late arrival -> { "type": "late_start", "delayMinutes": 15-240 }. Convert hours to minutes.
4. Extra or surprise guests -> { "type": "guest_surge", "extraGuests": <number> }. Use relative counts, not totals.
5. A budget cut or money falling through -> { "type": "budget_cut", "percent": 5-60 }. If only a rupee amount is given,
   do not compute a percentage: describe it in "unsupported" instead.
6. An item that is sold out or unavailable -> { "type": "item_unavailable", "family": <one of itemFamilies.family> }.
7. Never emit two scenarios of the same type.
8. "understood" restates the problem in one warm, plain sentence (max 300 chars) without inventing numbers.
9. Anything you cannot map (illness, injury, power cuts, etc.) goes in "unsupported" as a short honest note. Use null otherwise.

Worked Example:
Text: "Heavy rain and the photographer just cancelled"
Output:
{"scenarios":[{"type":"rain"},{"type":"vendor_cancels","category":"photography"}],"understood":"Heavy rain is forecast and your photographer has cancelled.","unsupported":null}`;

  const user = `Event Facts:
Setting: ${input.setting}
Guest Count: ${input.guestCount}
vendorCategories: ${JSON.stringify(input.vendorCategories)}
itemFamilies: ${JSON.stringify(input.itemFamilies)}

Host Description:
${wrapUntrusted(sanitized.text)}

Map into JSON:`;

  return { system, user };
}
