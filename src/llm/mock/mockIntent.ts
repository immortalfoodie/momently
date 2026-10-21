import type { BudgetCategory } from '@/domain/types';
import type { IntentInput, IntentOutput } from '@/llm/schemas/intent';

const AFFORD_PHRASES = ['can we fit', 'can we afford', 'is it possible to afford'];
const MUSIC_KEYWORDS = ['singer', 'music', 'dj', 'band'];
const PHOTO_KEYWORDS = ['photo', 'video'];

function parseQuantity(raw: string): number {
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    fifteen: 15, twenty: 20,
  };
  return words[raw.toLowerCase()] ?? parseInt(raw, 10);
}

function matchGuestCount(lower: string, currentGuests: number): IntentOutput | null {
  const moreMatch = /(\d+|one|two|three|four|five|ten|fifteen|twenty)\s+more\s+guests?\b/i.exec(lower);
  if (moreMatch?.[1]) {
    return { kind: 'change_guest_count', guestCount: currentGuests + parseQuantity(moreMatch[1]) };
  }
  const fewerMatch = /(\d+|one|two|three|four|five|ten|fifteen|twenty)\s+(?:fewer|less)\s+guests?\b/i.exec(lower);
  if (fewerMatch?.[1]) {
    return { kind: 'change_guest_count', guestCount: Math.max(1, currentGuests - parseQuantity(fewerMatch[1])) };
  }
  const absMatch = /(?:increase|decrease|change|set)?\s*guests?\s+(?:from\s+\d+\s+)?to\s+(\d+)\b/i.exec(lower);
  if (absMatch?.[1]) {
    return { kind: 'change_guest_count', guestCount: parseInt(absMatch[1], 10) };
  }
  return null;
}

function matchLateOrUnavailable(lower: string): IntentOutput | null {
  const lateHours = /(?:starts?|running|delayed)\s+(\d+|one|two|three|four|five)\s+hours?\s+late/i.exec(lower);
  if (lateHours?.[1]) {
    return { kind: 'simulate', scenario: { type: 'late_start', delayMinutes: parseQuantity(lateHours[1]) * 60 } };
  }
  const lateMins = /(?:starts?|running|delayed)\s+(\d+)\s+minutes?\s+late/i.exec(lower);
  if (lateMins?.[1]) {
    return { kind: 'simulate', scenario: { type: 'late_start', delayMinutes: parseInt(lateMins[1], 10) } };
  }
  if (lower.includes('cake is unavailable') || (lower.includes('cake') && lower.includes('unavailable')) || lower.includes('item unavailable')) {
    return { kind: 'simulate', scenario: { type: 'item_unavailable', family: 'catering_snacks' } };
  }
  return null;
}

function matchChaosSimulation(lower: string): IntentOutput | null {
  if (lower.includes('rain') || lower.includes('weather risk')) {
    return { kind: 'simulate', scenario: { type: 'rain' } };
  }
  const budgetCut = /budget\s+(?:drops|cut|reduced)\s+(?:by\s+)?(\d+)%/i.exec(lower);
  if (budgetCut?.[1]) {
    return { kind: 'simulate', scenario: { type: 'budget_cut', percent: parseInt(budgetCut[1], 10) } };
  }
  if ((lower.includes('photographer') || lower.includes('vendor')) && (lower.includes('cancell') || lower.includes('cancel'))) {
    return { kind: 'simulate', scenario: { type: 'vendor_cancels', category: 'photography' } };
  }
  return matchLateOrUnavailable(lower);
}

function detectAffordFamily(lower: string): string | null {
  if (MUSIC_KEYWORDS.some((kw) => lower.includes(kw))) return 'entertainment_music';
  if (PHOTO_KEYWORDS.some((kw) => lower.includes(kw))) return 'photo_video';
  if (lower.includes('decor')) return 'decor_theme';
  return null;
}

function matchAffordCheck(lower: string, msg: string): IntentOutput | null {
  if (!AFFORD_PHRASES.some((phrase) => lower.includes(phrase))) return null;
  const family = detectAffordFamily(lower);
  const description = lower.includes('singer') ? 'live singer' : msg.slice(0, 120);
  return { kind: 'afford_check', description, family, userStatedCost: null };
}

function matchCombineConcepts(lower: string): IntentOutput | null {
  if (!lower.includes('combine') || (!lower.includes('option') && !lower.includes('concept'))) {
    return null;
  }
  const borrowMatch = /(?:decorations|decor|items|catering)\s+from\s+option\s+([1-3])/i.exec(lower);
  const baseMatch = /(?:atmosphere|vibe|theme|concept)\s+of\s+option\s+([1-3])/i.exec(lower);
  const cheaperMatch = /(\d+)%\s+cheaper/i.exec(lower);
  const borrowCategories: BudgetCategory[] = ['decor'];
  return {
    kind: 'combine_concepts',
    baseRef: baseMatch?.[1] ?? '1',
    borrowRef: borrowMatch?.[1] ?? '2',
    borrowCategories,
    percentCheaper: cheaperMatch?.[1] ? parseInt(cheaperMatch[1], 10) : null,
  };
}

function matchSelectConcept(lower: string): IntentOutput | null {
  const pickMatch = /(?:pick|select|choose|go with)\s+(?:the\s+)?(?:option\s+([1-3])|concept\s+([1-3])|(.*?)(?:\s+concept)?$)/i.exec(lower);
  if (!pickMatch) return null;
  const ref = pickMatch[1] ?? pickMatch[2] ?? (pickMatch[3] ? pickMatch[3].trim() : '1');
  return { kind: 'select_concept', conceptRef: ref.slice(0, 80) };
}

function matchSaveMoney(lower: string): IntentOutput | null {
  const saveMatch = /save\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*)\b/i.exec(lower);
  if (!saveMatch?.[1]) return null;
  return { kind: 'save_money', amount: parseInt(saveMatch[1].replace(/,/g, ''), 10) };
}

function matchQualityChange(lower: string): IntentOutput | null {
  if (lower.includes('upgrade')) {
    const isPhoto = lower.includes('photo') || lower.includes('video');
    const isMusic = lower.includes('music') || lower.includes('singer');
    const family = isPhoto ? 'photo_video' : isMusic ? 'entertainment_music' : 'decor_theme';
    return { kind: 'upgrade', family, toQuality: 'premium' };
  }
  if (lower.includes('downgrade')) {
    const family = (lower.includes('music') || lower.includes('singer')) ? 'entertainment_music' : 'decor_theme';
    return { kind: 'downgrade', family, toQuality: 'essential' };
  }
  return null;
}

function matchPreferences(lower: string): IntentOutput | null {
  if (lower.includes('wheelchair') || lower.includes('accessible') || lower.includes('accessibility')) {
    return {
      kind: 'add_preference',
      preferenceKind: 'accessibility',
      description: 'Wheelchair accessibility required for venue and seating',
      severity: 'hard',
    };
  }
  if (lower.includes('jain')) {
    return {
      kind: 'add_preference',
      preferenceKind: 'dietary',
      description: 'Dedicated Jain food catering counter required',
      severity: 'hard',
    };
  }
  return null;
}

const PREMIUM_KEYWORDS = ['feel expensive', 'make it premium', 'luxury tier'];
const FORGOTTEN_KEYWORDS = ['forgetting', 'forgotten', 'did i miss'];
const SAVING_KEYWORDS = ['where can i save', 'how to save', 'find savings'];

function matchPremiumOrForgotten(lower: string): IntentOutput | null {
  if (PREMIUM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { kind: 'make_it_premium' };
  }
  if (FORGOTTEN_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { kind: 'find_forgotten' };
  }
  return null;
}

function matchAdviceOrChecklist(lower: string): IntentOutput | null {
  if (SAVING_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'answer',
      reply: 'You can achieve meaningful savings by stepping down decor or live music from premium to standard, or by adjusting optional favor items.',
    };
  }
  if (lower.includes('checklist')) {
    return {
      kind: 'answer',
      reply: 'Your final checklist is ready, covering venue booking confirmation, menu finalization, music playlist signoff, and photography milestones.',
    };
  }
  return null;
}

/**
 * Deterministic table-driven mock implementation of the intent classification task.
 * WHY: Provides instantaneous, offline parsing of conversational host adjustments and simulations.
 */
export function mockIntent(input: IntentInput): IntentOutput {
  const msg = input.message.trim();
  const lower = msg.toLowerCase();
  const currentGuests = input.planSummary.meta.guestCount;

  const matchers = [
    () => matchGuestCount(lower, currentGuests),
    () => matchChaosSimulation(lower),
    () => matchAffordCheck(lower, msg),
    () => matchCombineConcepts(lower),
    () => matchSelectConcept(lower),
    () => matchSaveMoney(lower),
    () => matchQualityChange(lower),
    () => matchPreferences(lower),
    () => matchPremiumOrForgotten(lower),
    () => matchAdviceOrChecklist(lower),
  ];

  for (const match of matchers) {
    const res = match();
    if (res) return res;
  }

  return {
    kind: 'clarify',
    question: 'Could you please clarify your request regarding the event plan?',
  };
}
