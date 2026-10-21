/**
 * Empirical keyword associations for heuristic family mapping.
 * WHY: Translates natural language host briefs and constraint notes to standardized
 * rate-card families deterministically without relying on fuzzy or non-deterministic LLM parsing.
 */
export const FAMILY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  venue_hall: ['venue', 'hall', 'banquet', 'resort', 'lawn', 'palace', 'location'],
  weather_cover: [
    'weather cover',
    'tent',
    'canopy',
    'rain cover',
    'monsoon',
    'waterproof',
    'tarpaulin',
    'shade',
  ],
  catering_buffet: [
    'cater',
    'catering',
    'food',
    'buffet',
    'dinner',
    'lunch',
    'menu',
    'meal',
    'cuisine',
    'feast',
  ],
  catering_snacks: [
    'snack',
    'snacks',
    'hi-tea',
    'tea',
    'coffee',
    'chaat',
    'refreshment',
    'starter',
  ],
  decor_theme: [
    'decor',
    'decoration',
    'flower',
    'floral',
    'lighting',
    'stage',
    'mandap',
    'backdrop',
    'theme',
  ],
  photo_video: [
    'photo',
    'photography',
    'video',
    'videography',
    'camera',
    'shoot',
    'album',
    'cinematography',
  ],
  entertainment_music: [
    'music',
    'singer',
    'band',
    'dj',
    'live',
    'sound',
    'orchestra',
    'performance',
    'acoustic',
  ],
  sound_stage: [
    'sound system',
    'stage lighting',
    'speaker',
    'audio',
    'mic',
    'av',
    'screen',
    'projector',
  ],
  transport_guest: [
    'transport',
    'shuttle',
    'bus',
    'cab',
    'car',
    'travel',
    'coach',
    'pickup',
    'drop',
    'transit',
  ],
  gifts_favours: [
    'gift',
    'gifts',
    'favour',
    'favours',
    'favor',
    'favors',
    'giveaway',
    'hamper',
    'keepsake',
    'mithai',
    'potli',
  ],
  invitations_stationery: [
    'invite',
    'invites',
    'invitation',
    'invitations',
    'card',
    'cards',
    'stationery',
    'print',
    'e-invite',
  ],
  permits_licences: [
    'permit',
    'permits',
    'license',
    'licenses',
    'licence',
    'licences',
    'permission',
    'noc',
    'police',
    'ppl',
    'iprs',
  ],
  volunteer_kit: [
    'volunteer',
    'volunteers',
    'badge',
    'badges',
    'kit',
    'safety',
    'crew',
    'lanyard',
    'first aid',
  ],
};

/**
 * Purely maps natural language text to a matching rate family via deterministic keyword lookups.
 * WHY: Provides deterministic first-match-wins resolution for constraints (e.g. "must_have DJ" -> entertainment_music).
 *
 * @param text - Natural language search phrase or constraint description.
 * @returns Matched family identifier or undefined if no keywords match.
 */
export function familyForText(text: string): string | undefined {
  const normalized = text.toLowerCase();

  for (const [family, keywords] of Object.entries(FAMILY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return family;
      }
    }
  }

  return undefined;
}
