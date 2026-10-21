import { intakeOutputSchema, type IntakeInput } from '@/llm/schemas/intake';
import { sanitizeUserText, wrapUntrusted } from '@/llm/sanitize';
import { SHARED_RULES } from './shared';
import { z } from 'zod';

export interface PromptPayload {
  system: string;
  user: string;
}

/**
 * Builds system and user prompts for the intake extraction task.
 * WHY: Translates natural language event briefs into strictly validated plan initialization entities.
 */
export function buildIntakePrompt(input: IntakeInput): PromptPayload {
  const sanitized = sanitizeUserText(input.text, 1500);
  const wrappedUserText = wrapUntrusted(sanitized.text);

  const jsonSchema = JSON.stringify(z.toJSONSchema(intakeOutputSchema));

  const system = `${SHARED_RULES}

Task: Event Intake Extraction
Extract host event requirements from the untrusted user brief into a structured JSON object matching this schema:
${jsonSchema}

Specific Field Rules:
- title: concise event title (max 80 chars).
- type: 'wedding' | 'birthday' | 'anniversary' | 'community'.
- city: Indian city name or null if unspecified.
- dateIso: YYYY-MM-DD or null. Today's reference date is ${input.today}.
- guestCount: integer 1-5000 or null.
- setting: 'indoor' | 'outdoor' | 'mixed' | 'undecided' or null.
- budgetCap: integer INR or null.
- budgetIsHard: boolean. True by default whenever a budget is stated. Set false ONLY when soft wording is used for budget (e.g., "around", "roughly", "flexible", "ideally").
- constraints: list of must_have, avoid, style, dietary, accessibility, venue, date. NEVER include budget_cap or guest_count in constraints!
- missingInfo: up to 4 missing critical fields ('city' | 'guestCount' | 'budget' | 'date' | 'type') with friendly clarifying questions.
- Unknown fields must be null, never guessed.

Worked Example:
User Brief:
"I want to celebrate my parents' 25th anniversary in Mumbai. Around 80 guests, budget ₹1.5 lakh. They love old Bollywood songs, elegant decorations, and good food."
Output:
{
  "title": "Parents' 25th Anniversary",
  "type": "anniversary",
  "city": "Mumbai",
  "dateIso": null,
  "guestCount": 80,
  "setting": "undecided",
  "budgetCap": 150000,
  "budgetIsHard": true,
  "constraints": [
    { "kind": "style", "description": "Spotlight classic 1970s-90s Bollywood melodies", "severity": "soft" },
    { "kind": "style", "description": "Tasteful, dignified elegant decorations", "severity": "soft" },
    { "kind": "must_have", "description": "Delicious hot dinner catering spread", "severity": "soft" }
  ],
  "guestNeeds": {},
  "styleTags": ["bollywood", "retro", "elegant"],
  "missingInfo": [
    { "field": "date", "question": "What date or month are you planning for the anniversary?" }
  ]
}`;

  const user = `Today's Date: ${input.today}

User Brief:
${wrappedUserText}

Extract and output the JSON object:`;

  return { system, user };
}
