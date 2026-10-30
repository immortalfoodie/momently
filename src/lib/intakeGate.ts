const EVENT_KEYWORDS = [
  'wedding', 'shaadi', 'shadi', 'vivah', 'marriage', 'reception', 'engagement', 'roka', 'sagai',
  'haldi', 'mehendi', 'mehndi', 'sangeet', 'birthday', 'bday', 'janmdin', 'anniversary',
  'party', 'celebration', 'celebrate', 'festival', 'puja', 'pooja', 'diwali', 'holi', 'navratri',
  'garba', 'ganpati', 'eid', 'christmas', 'baby shower', 'godh bharai', 'naming ceremony', 'namkaran',
  'housewarming', 'griha pravesh', 'graduation', 'farewell', 'reunion', 'get-together', 'get together',
  'gathering', 'event', 'function', 'ceremony',
];

const NUMBER_HINT = /(\d+\s*(guests?|people|log|lakh|lac|k\b|thousand))|(₹|rs\.?\s*\d|inr\s*\d)/i;

/**
 * Decides whether a free-text chat message describes a celebration worth turning into a plan.
 * WHY: Outside an event, the assistant creates a brand-new plan from the message. Greetings or
 * questions like "hey" must not silently spawn a default wedding and redirect the host away.
 *
 * @param text - Raw message typed by the host.
 * @returns True when the text mentions an event type, guests, budget or similar planning detail.
 */
export function looksLikeEventBrief(text: string): boolean {
  const normalized = text.toLowerCase();
  if (NUMBER_HINT.test(normalized)) return true;
  return EVENT_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`).test(normalized));
}

/** Reply shown when an intake message does not describe an event yet. */
export const INTAKE_CLARIFY_REPLY =
  "Hi! Tell me about the celebration you're planning — the occasion, roughly how many guests, the city and your budget. For example: \"A birthday party for 40 guests in Pune under ₹1 lakh\".";
