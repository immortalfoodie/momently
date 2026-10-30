import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { ChaosDescribeInput, ChaosDescribeOutput } from '@/llm/schemas/chaosDescribe';

const RAIN_WORDS = ['rain', 'storm', 'monsoon', 'downpour', 'baarish', 'barish', 'thunder'];
const CANCEL_WORDS = ['cancel', 'backed out', 'back out', 'no-show', 'no show', "didn't show", 'not coming', 'dropped out'];
const UNAVAILABLE_WORDS = ['unavailable', 'out of stock', 'sold out', 'not available', 'ran out', 'nahi mil'];
const BUDGET_WORDS = ['budget', 'money', 'funds', 'paisa', 'sponsor'];
const UNSUPPORTED_WORDS = ['sick', 'ill', 'injur', 'power cut', 'electricity', 'fire', 'accident', 'fight'];

/** Words that point at a vendor category used in plans. */
const VENDOR_SYNONYMS: ReadonlyArray<{ category: string; words: string[] }> = [
  { category: 'photography', words: ['photo', 'camera', 'video'] },
  { category: 'entertainment', words: ['dj', 'singer', 'band', 'music', 'anchor', 'emcee'] },
  { category: 'food', words: ['cater', 'food', 'cook', 'halwai'] },
  { category: 'decor', words: ['decor', 'florist', 'flower'] },
  { category: 'venue', words: ['venue', 'hall', 'banquet'] },
  { category: 'planning', words: ['planner', 'coordinator'] },
];

/** Words that point at a rate-card item family. */
const FAMILY_SYNONYMS: ReadonlyArray<{ family: string; words: string[] }> = [
  { family: 'catering_snacks', words: ['cake', 'snack', 'sweet', 'dessert'] },
  { family: 'decor_theme', words: ['flower', 'decor', 'backdrop'] },
  { family: 'entertainment_music', words: ['dhol', 'speaker', 'sound', 'music'] },
  { family: 'photo_video', words: ['camera', 'drone'] },
  { family: 'catering_buffet', words: ['buffet', 'food', 'dinner'] },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, fifty: 50,
};

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((w) => text.includes(w));
}

function toNumber(raw: string): number {
  return NUMBER_WORDS[raw] ?? Number.parseInt(raw, 10);
}

function matchLate(text: string): ChaosScenarioInput | null {
  const hours = /(\d+|one|two|three|four)\s*(?:hours?|hrs?|ghante)/.exec(text);
  const minutes = /(\d+)\s*(?:minutes?|mins?)/.exec(text);
  const delay = hours?.[1] ? toNumber(hours[1]) * 60 : minutes?.[1] ? toNumber(minutes[1]) : null;
  const mentionsLate = hasAny(text, ['late', 'delay', 'traffic', 'stuck', 'der']);
  if (!mentionsLate) return null;
  const delayMinutes = Math.min(240, Math.max(15, delay ?? 60));
  return { type: 'late_start', delayMinutes };
}

function matchSurge(text: string): ChaosScenarioInput | null {
  const m = /(\d+|ten|fifteen|twenty|thirty|fifty)\s+(?:more|extra|additional|surprise)\s+(?:guests?|people|log)/.exec(text);
  if (!m?.[1]) return null;
  return { type: 'guest_surge', extraGuests: Math.min(1000, Math.max(1, toNumber(m[1]))) };
}

function matchBudget(text: string): ChaosScenarioInput | null {
  const m = /(\d+)\s*(?:%|percent)/.exec(text);
  if (!m?.[1] || !hasAny(text, BUDGET_WORDS)) return null;
  return { type: 'budget_cut', percent: Math.min(60, Math.max(5, toNumber(m[1]))) };
}

function matchVendor(text: string, categories: readonly string[]): ChaosScenarioInput | null {
  if (!hasAny(text, CANCEL_WORDS)) return null;
  const hit = VENDOR_SYNONYMS.find((v) => categories.includes(v.category) && hasAny(text, v.words));
  return hit ? { type: 'vendor_cancels', category: hit.category } : null;
}

function matchItem(text: string, families: readonly string[]): ChaosScenarioInput | null {
  if (!hasAny(text, UNAVAILABLE_WORDS)) return null;
  const hit = FAMILY_SYNONYMS.find((f) => families.includes(f.family) && hasAny(text, f.words));
  return hit ? { type: 'item_unavailable', family: hit.family } : null;
}

const UNDERSTOOD_PHRASES: Record<ChaosScenarioInput['type'], (s: ChaosScenarioInput) => string> = {
  rain: () => 'rain hits the event',
  vendor_cancels: (s) => (s.type === 'vendor_cancels' ? `your ${s.category} vendor cancels` : ''),
  late_start: (s) => (s.type === 'late_start' ? `things start ${s.delayMinutes} minutes late` : ''),
  guest_surge: (s) => (s.type === 'guest_surge' ? `${s.extraGuests} extra guests arrive` : ''),
  budget_cut: (s) => (s.type === 'budget_cut' ? `your budget drops by ${s.percent}%` : ''),
  item_unavailable: () => 'a key item becomes unavailable',
};

/**
 * Deterministic keyword mapper simulating the chaos_describe LLM task offline.
 * WHY: Keeps the free-text Chaos Lab fully usable in demo mode and CI without an API key.
 */
export function mockChaosDescribe(input: ChaosDescribeInput): ChaosDescribeOutput {
  const text = input.text.toLowerCase();
  const families = input.itemFamilies.map((f) => f.family);

  const candidates: Array<ChaosScenarioInput | null> = [
    hasAny(text, RAIN_WORDS) && input.setting !== 'indoor' ? { type: 'rain' } : null,
    matchVendor(text, input.vendorCategories),
    matchLate(text),
    matchSurge(text),
    matchBudget(text),
    matchItem(text, families),
  ];
  const scenarios = candidates.filter((c): c is ChaosScenarioInput => c !== null).slice(0, 3);

  const unsupported = hasAny(text, UNSUPPORTED_WORDS)
    ? 'Part of this (such as illness, injury or a power cut) is outside what Chaos Lab can simulate. Keep a local emergency contact handy for that.'
    : null;

  const understood =
    scenarios.length > 0
      ? `Got it: ${scenarios.map((s) => UNDERSTOOD_PHRASES[s.type](s)).join(', and ')}.`
      : "I couldn't match that to a problem Chaos Lab can simulate yet.";

  return { scenarios, understood, unsupported };
}
