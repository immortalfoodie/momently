import { KNOWN_CITY_TIERS } from '@/domain/constants';
import type { EventSetting, EventType } from '@/domain/types';
import type {
  IntakeConstraint,
  IntakeInput,
  IntakeOutput,
  MissingInfoItem,
} from '@/llm/schemas/intake';

const EVENT_KEYWORDS: Array<{ type: EventType; terms: string[] }> = [
  { type: 'wedding', terms: ['wedding', 'shaadi', 'marriage'] },
  { type: 'birthday', terms: ['birthday', 'bday'] },
  { type: 'anniversary', terms: ['anniversary', 'jubilee'] },
  { type: 'community', terms: ['community', 'society', 'rwa', 'festival', 'fundraiser'] },
];

function extractEventType(lower: string): EventType {
  for (const item of EVENT_KEYWORDS) {
    if (item.terms.some((term) => lower.includes(term))) {
      return item.type;
    }
  }
  return 'wedding';
}

function extractGuestCount(text: string): number | null {
  const match = /(?:around|approx|about)?\s*(\d{1,4})\s*(?:guests?|people|pax|members|attendees)\b/i.exec(text);
  if (match?.[1]) {
    const val = parseInt(match[1], 10);
    if (val >= 1 && val <= 5000) return val;
  }
  return null;
}

function extractBudget(text: string): { amount: number | null; isHard: boolean } {
  const lakhMatch = /(?:around|roughly|flexible|ideally)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i.exec(text);
  if (lakhMatch?.[1]) {
    const lakhVal = Math.round(parseFloat(lakhMatch[1]) * 100000);
    const soft = /(?:around|roughly|flexible|ideally)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\s*(?:lakh|lac)/i.test(text);
    return { amount: lakhVal, isHard: !soft };
  }
  const kMatch = /(?:₹|rs\.?|inr)?\s*(\d+)\s*k\b/i.exec(text);
  if (kMatch?.[1]) return { amount: parseInt(kMatch[1], 10) * 1000, isHard: true };

  const intMatch = /(?:budget\s*(?:is|of|cap)?\s*)?(?:₹|rs\.?|inr)?\s*(\d{4,8})\b/i.exec(text);
  if (intMatch?.[1]) return { amount: parseInt(intMatch[1], 10), isHard: true };

  return { amount: null, isHard: true };
}

function extractCity(lower: string): string | null {
  for (const city of Object.keys(KNOWN_CITY_TIERS)) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return null;
}

function extractSetting(lower: string): EventSetting | null {
  if (lower.includes('outdoor') || lower.includes('lawn') || lower.includes('garden') || lower.includes('terrace')) {
    return 'outdoor';
  }
  if (lower.includes('hall') || lower.includes('banquet') || lower.includes('indoor')) return 'indoor';
  if (lower.includes('mixed')) return 'mixed';
  return null;
}

function extractDate(text: string): string | null {
  const iso = /\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/.exec(text);
  if (iso?.[1]) return iso[1];

  const dateMatch = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i.exec(text);
  if (dateMatch?.[1] && dateMatch[2] && dateMatch[3]) {
    const day = dateMatch[1].padStart(2, '0');
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[dateMatch[2].toLowerCase().slice(0, 3)] ?? '01';
    return `${dateMatch[3]}-${m}-${day}`;
  }
  return null;
}

function getDemoIntake(): IntakeOutput {
  return {
    title: "Parents' 25th Anniversary",
    type: 'anniversary',
    city: 'Mumbai',
    dateIso: '2026-12-15',
    guestCount: 80,
    setting: 'undecided',
    budgetCap: 150000,
    budgetIsHard: true,
    constraints: [
      { kind: 'style', description: 'Music program should spotlight classic 1970s-90s Bollywood melodies', severity: 'soft' },
      { kind: 'style', description: 'Atmosphere should feel tasteful, dignified, and refined without ostentation', severity: 'soft' },
      { kind: 'must_have', description: 'Delicious hot dinner spread catering to traditional family palates', severity: 'soft' },
      { kind: 'style', description: 'Sophisticated ambience that feels premium without ostentatious luxury', severity: 'soft' },
    ],
    guestNeeds: {},
    styleTags: ['bollywood', 'retro', 'elegant'],
    missingInfo: [],
  };
}

function buildMissingInfoList(
  city: string | null,
  guestCount: number | null,
  budget: number | null,
  dateIso: string | null,
): MissingInfoItem[] {
  const missingInfo: MissingInfoItem[] = [];
  if (!city) missingInfo.push({ field: 'city', question: 'Which city will the celebration take place in?' });
  if (!guestCount) missingInfo.push({ field: 'guestCount', question: 'Approximately how many guests are you expecting?' });
  if (budget === null) missingInfo.push({ field: 'budget', question: 'What is your estimated total budget in Rupees?' });
  if (!dateIso) missingInfo.push({ field: 'date', question: 'What date or month are you planning for the event?' });
  return missingInfo.slice(0, 4);
}

/**
 * Deterministic rule-based mock implementation of the intake extraction task.
 * WHY: Enables complete end-to-end plan initialization without external Gemini API keys or network I/O.
 */
export function mockIntake(input: IntakeInput): IntakeOutput {
  const rawText = input.text;
  const lower = rawText.toLowerCase();

  // Benchmark 25th anniversary demo brief match
  if (lower.includes("parents' 25th anniversary") || (lower.includes('25th anniversary') && lower.includes('mumbai'))) {
    return getDemoIntake();
  }

  const type = extractEventType(lower);
  const guestCount = extractGuestCount(rawText);
  const budget = extractBudget(rawText);
  const city = extractCity(lower);
  const dateIso = extractDate(rawText);
  const setting = extractSetting(lower);

  const constraints: IntakeConstraint[] = [];
  const styleTags: string[] = [];

  if (lower.includes('bollywood')) {
    constraints.push({ kind: 'style', description: 'Bollywood music and themed ambiance', severity: 'soft' });
    styleTags.push('bollywood');
  }
  if (lower.includes('elegant')) {
    constraints.push({ kind: 'style', description: 'Elegant decorations and refined setup', severity: 'soft' });
    styleTags.push('elegant');
  }

  const missingInfo = buildMissingInfoList(city, guestCount, budget.amount, dateIso);
  const titlePrefix = type.charAt(0).toUpperCase() + type.slice(1);
  const title = city ? `${titlePrefix} Celebration in ${city}` : `${titlePrefix} Celebration`;

  return {
    title: title.slice(0, 80),
    type,
    city,
    dateIso,
    guestCount,
    setting,
    budgetCap: budget.amount,
    budgetIsHard: budget.isHard,
    constraints,
    guestNeeds: {},
    styleTags: styleTags.slice(0, 6),
    missingInfo,
  };
}
