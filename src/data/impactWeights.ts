/**
 * Families that heavily dictate attendee perception of celebration quality.
 * WHY: "Make it feel expensive" philosophy: guests notice grand decor, atmospheric lighting,
 * live music, and professional photos far more than peripheral logistics or small favours.
 */
export const HIGH_IMPACT_FAMILIES = [
  'decor_theme',
  'entertainment_music',
  'photo_video',
] as const;

/**
 * Families that are functional and lower-visibility to event guests.
 * WHY: When budget caps require funding high-impact upgrades, stepping down these categories
 * preserves guest experience while recovering necessary budget.
 */
export const LOW_VISIBILITY_FAMILIES = [
  'transport_guest',
  'gifts_favours',
  'invitations_stationery',
] as const;
