/**
 * Plain-English copy dictionary for view headers across Momently.
 *
 * DESIGN DECISION (WHY):
 * Centralizes host-facing titles and descriptions to ensure warm, accessible language
 * free of technical jargon, corporate buzzwords, and banned terms (such as ledger,
 * deterministic, provenance, lever, floor, utilization, milestone, synthesize, rate-card).
 */

export interface PageCopyEntry {
  title: string;
  description: string;
}

export const PAGE_COPY = {
  home: {
    title: 'Celebration Studio',
    description: 'Plan weddings, birthdays, and anniversaries with clear budgets, schedules, and calm guidance.',
  },
  new: {
    title: 'New Celebration',
    description: 'Start planning your celebration in seconds with a few quick details or a conversation.',
  },
  events: {
    title: 'My Celebrations',
    description: 'Saved plans in this browser. Everything is private and works offline.',
  },
  settings: {
    title: 'Settings',
    description: 'Manage your AI connection, export backups, and control your browser data.',
  },
  overview: {
    title: 'Celebration Overview',
    description: 'A high-level view of your celebration: key facts, budget, schedule, and next steps.',
  },
  concepts: {
    title: 'Celebration Concepts',
    description: 'Explore distinct celebration styles with tailored vendor tiers, color palettes, and costs.',
  },
  budget: {
    title: 'Budget',
    description: 'See where every rupee goes, and what changes if you add, upgrade or cut something.',
  },
  timeline: {
    title: 'Timeline',
    description: 'Your day, hour by hour. Move sessions around or plan for delays.',
  },
  checklist: {
    title: 'Checklist',
    description: "Everything to do before the day, grouped by how soon it's due.",
  },
  guests: {
    title: 'Guests',
    description: 'Tell us what your guests need, so food, seating and access work for everyone.',
  },
  vendors: {
    title: 'Vendors',
    description: 'Track quotes, compare options, and manage booking needs for every celebration service.',
  },
  chaos: {
    title: 'Chaos Lab',
    description: 'Stress-test your celebration before reality does.',
  },
  dayOf: {
    title: 'Event Day',
    description: "A calm, phone-friendly view for the day itself: what's on now, what's next, and what to do if something goes wrong.",
  },
  kit: {
    title: 'Event Kit',
    description: 'Export printable run sheets, vendor briefs, budget sheets, and calendar files.',
  },
  kitPlan: {
    title: 'Printable Plan',
    description: 'A printer-friendly summary of your schedule, budget, contacts, and checklists.',
  },
} as const satisfies Record<string, PageCopyEntry>;
