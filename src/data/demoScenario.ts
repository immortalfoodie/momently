import { conceptSchema, constraintSchema, eventMetaSchema } from '@/domain/schemas';
import type { Concept, Constraint, EventMeta } from '@/domain/types';

export interface ScriptedStep {
  id: string;
  label: string;
  userMessage: string;
}

export interface DemoScenario {
  hostBrief: string;
  meta: EventMeta;
  constraints: Constraint[];
  concepts: Concept[];
  scriptedSteps: ScriptedStep[];
}

const hostBrief =
  "I want to celebrate my parents' 25th anniversary in Mumbai. Around 80 guests, budget ₹1.5 lakh. They love old Bollywood songs, elegant decorations, and good food. I want something memorable without making it look too expensive.";

const meta: EventMeta = eventMetaSchema.parse({
  title: "Parents' 25th Anniversary",
  type: 'anniversary',
  city: 'Mumbai',
  dateIso: '2026-12-15',
  guestCount: 80,
  setting: 'undecided',
  hostBrief,
});

const constraints: Constraint[] = [
  constraintSchema.parse({
    id: 'c_budget_cap',
    kind: 'budget_cap',
    severity: 'hard',
    description: 'Total expenditure must not exceed ₹1,50,000',
    numericValue: 150000,
  }),
  constraintSchema.parse({
    id: 'c_music_style',
    kind: 'style',
    severity: 'soft',
    description: 'Music program should spotlight classic 1970s-90s Bollywood melodies',
    textValue: 'Old Bollywood songs',
  }),
  constraintSchema.parse({
    id: 'c_decor_elegance',
    kind: 'style',
    severity: 'soft',
    description:
      'Atmosphere should feel tasteful, dignified, and refined without ostentation',
    textValue: 'Elegant decorations',
  }),
  constraintSchema.parse({
    id: 'c_food_quality',
    kind: 'must_have',
    severity: 'soft',
    description: 'Delicious hot dinner spread catering to traditional family palates',
    textValue: 'High quality food and catering',
  }),
  constraintSchema.parse({
    id: 'c_value_perception',
    kind: 'style',
    severity: 'soft',
    description: 'Sophisticated ambience that feels premium without ostentatious luxury',
    textValue: 'Memorable without looking expensive',
  }),
];

const concepts: Concept[] = [
  conceptSchema.parse({
    id: 'concept_vintage_bollywood',
    title: 'Vintage Bollywood Evening',
    tagline: 'Retro cinema glamour with golden-era tunes and warm lighting',
    summary:
      'An intimate musical tribute featuring retro vinyl aesthetic, classic cinema poster motifs, and acoustic Bollywood classics.',
    palette: ['#8B0000', '#DAA520', '#F5F5DC', '#2F4F4F'],
    experienceHighlights: [
      'Retro vinyl record photo wall with parents vintage portraits',
      'Live singer performing golden-era Kishore and Lata duets',
      'Signature cocktail counter named after iconic classic films',
      'Surprise video montage of family memories on projector',
    ],
    estimatedTotal: 138000,
    tradeoffs: [
      'Standard floral budget prioritizes stage lighting and sound',
      'Buffet menu focuses on proven crowd favorites over exotic dishes',
    ],
    whyItFits:
      'Directly fulfills the parents passion for old Bollywood melodies while remaining strictly inside the ₹1.5L cap.',
    tags: ['bollywood', 'retro', 'music', 'nostalgia'],
    qualityProfile: {
      decor: 'standard',
      entertainment_music: 'standard',
      photo_video: 'essential',
      catering_buffet: 'standard',
    },
  }),
  conceptSchema.parse({
    id: 'concept_golden_celebration',
    title: 'Elegant Golden Celebration',
    tagline: 'Classic silver-jubilee banquet with subtle gold accents',
    summary:
      'Understated grandeur with warm candlelit tables, refined white florals, and a formal family toast program.',
    palette: ['#FFD700', '#FDF5E6', '#708090', '#1C1C1C'],
    experienceHighlights: [
      'Champagne flute welcome with sparkling apple cider',
      'Dedicated silver jubilee memory book signing station',
      'Acoustic violin and keyboard background ensemble',
      'Curated four-course seated buffet dinner',
    ],
    estimatedTotal: 149000,
    tradeoffs: [
      'Utilizes almost all available budget leaving minimal buffer',
      'Fewer party games to preserve dignified ballroom atmosphere',
    ],
    whyItFits:
      'Creates a visually stunning milestone milestone celebration matching the host desire for tasteful elegance.',
    tags: ['golden', 'elegant', 'formal', 'milestone'],
    qualityProfile: {
      decor: 'premium',
      catering_buffet: 'standard',
      entertainment_music: 'essential',
      photo_video: 'essential',
    },
  }),
  conceptSchema.parse({
    id: 'concept_memory_lane',
    title: 'Memory Lane',
    tagline: 'A heartwarming journey through 25 cherished years',
    summary:
      'A relaxed, deeply personal gathering centered around family storytelling, home-style regional delicacies, and laughter.',
    palette: ['#556B2F', '#E6DFD3', '#D2B48C', '#8B4513'],
    experienceHighlights: [
      'Chronological photo timeline spanning 1999 to 2024',
      'Open-mic storytelling session with siblings and close friends',
      'Comfort-food live counters showcasing regional favorites',
      'Handmade commemorative memory favors for all attendees',
    ],
    estimatedTotal: 126000,
    tradeoffs: [
      'Simpler audio setup relying on family-curated playlists',
      'Unstructured dance time in favor of conversation',
    ],
    whyItFits:
      'Provides maximum emotional connection with the lowest financial stress, saving over ₹24,000 below budget cap.',
    tags: ['intimate', 'family', 'storytelling', 'budget-friendly'],
    qualityProfile: {
      photo_video: 'premium',
      decor: 'essential',
      entertainment_music: 'essential',
      catering_buffet: 'standard',
    },
  }),
];

const scriptedSteps: ScriptedStep[] = [
  {
    id: 'step_1_intake',
    label: 'Intake Brief',
    userMessage: hostBrief,
  },
  {
    id: 'step_2_select_concept',
    label: 'Select Concept',
    userMessage: "Let's go with the Vintage Bollywood Evening concept.",
  },
  {
    id: 'step_3_upgrade_decor',
    label: 'Upgrade Decor',
    userMessage: 'Upgrade the decor but keep the budget fixed.',
  },
  {
    id: 'step_4_increase_guests',
    label: 'Increase Guests',
    userMessage: 'Increase guests from 80 to 110.',
  },
  {
    id: 'step_5_rain_contingency',
    label: 'Weather Risk',
    userMessage: 'What if it rains?',
  },
  {
    id: 'step_6_final_checklist',
    label: 'Final Checklist',
    userMessage: 'Generate my final checklist.',
  },
];

/**
 * Validated benchmark demo scenario for testing and mock LLM simulations.
 * WHY: Provides reproducible end-to-end plan inputs matching the milestone anniversary problem statement.
 */
export const DEMO_SCENARIO: DemoScenario = {
  hostBrief,
  meta,
  constraints,
  concepts,
  scriptedSteps,
};
