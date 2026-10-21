import { DEMO_SCENARIO } from '@/data/demoScenario';
import { getTemplate } from '@/data/templates';
import type { QualityLevel } from '@/domain/types';
import type { ConceptsInput, ConceptsOutput } from '@/llm/schemas/concepts';

const FIXED_PALETTES: readonly (readonly string[])[] = [
  ['#2E4057', '#048A81', '#F4D35E', '#EE964B'], // Lean / Organic
  ['#1D3557', '#457B9D', '#A8DADC', '#F1FAEE'], // Balanced / Classic
  ['#6B2D5C', '#F39237', '#E01A4F', '#0E79B2'], // Experience-led / Vibrant
];

/**
 * Deterministic mock implementation of the concepts generation task.
 * WHY: Returns the benchmark DEMO_SCENARIO concepts for the demo anniversary brief,
 * or deterministically generates 3 distinct tiered concepts for any event type without calling Gemini.
 */
export function mockConcepts(input: ConceptsInput): ConceptsOutput {
  const isDemo =
    input.brief.type === 'anniversary' &&
    (input.brief.city?.toLowerCase() === 'mumbai' ||
      input.brief.title.toLowerCase().includes('anniversary'));

  if (isDemo && DEMO_SCENARIO.concepts.length === 3) {
    return {
      concepts: DEMO_SCENARIO.concepts.map((c) => ({
        title: c.title,
        tagline: c.tagline,
        summary: c.summary,
        palette: c.palette,
        experienceHighlights: c.experienceHighlights,
        qualityProfile: c.qualityProfile ?? {
          decor: 'standard',
          catering_buffet: 'standard',
          entertainment_music: 'standard',
          photo_video: 'essential',
        },
        tradeoffs: c.tradeoffs,
        whyItFits: c.whyItFits,
        tags: c.tags,
      })),
    };
  }

  const template = getTemplate(input.planSummary.meta.type);
  const styles = template.styleSuggestions;
  const allowed = input.planSummary.allowedFamilies;

  function buildProfile(decor: QualityLevel, photo: QualityLevel, catering: QualityLevel, music: QualityLevel) {
    const profile: Record<string, QualityLevel> = {};
    for (const f of allowed) {
      if (f.includes('decor')) profile[f] = decor;
      else if (f.includes('photo')) profile[f] = photo;
      else if (f.includes('cater') || f.includes('food')) profile[f] = catering;
      else if (f.includes('music') || f.includes('entertainment')) profile[f] = music;
      else profile[f] = 'standard';
    }
    return profile;
  }

  const c1Title = styles[0] ?? 'Classic Simplicity';
  const c2Title = styles[1] ?? 'Harmonious Celebration';
  const c3Title = styles[2] ?? 'Grand Highlights';

  return {
    concepts: [
      {
        title: c1Title,
        tagline: 'Warm, personal celebration focused on close connections',
        summary: `A budget-conscious, cozy setup spotlighting ${c1Title.toLowerCase()} touches with lean operational spend.`,
        palette: [...FIXED_PALETTES[0]!],
        experienceHighlights: [
          'Intimate welcoming moment for arriving guests',
          'Curated background music playlist by the hosts',
          'Comfort family dinner spread',
        ],
        qualityProfile: buildProfile('essential', 'essential', 'standard', 'essential'),
        tradeoffs: ['Simpler floral accents in favor of lower overall costs'],
        whyItFits: 'Maximizes emotional value while leaving ample financial buffer under the budget cap.',
        tags: ['intimate', 'cozy', 'budget-friendly'],
      },
      {
        title: c2Title,
        tagline: 'Balanced celebration with refined decor and lively hospitality',
        summary: `A well-rounded festive gathering featuring ${c2Title.toLowerCase()} aesthetics and crowd-pleasing hospitality.`,
        palette: [...FIXED_PALETTES[1]!],
        experienceHighlights: [
          'Signature entrance photo-booth with personalized backdrop',
          'Live acoustic performance during the dinner hour',
          'Four-course buffet featuring regional specialties',
        ],
        qualityProfile: buildProfile('standard', 'standard', 'standard', 'standard'),
        tradeoffs: ['Even allocation of funds without lavish single-item splurges'],
        whyItFits: 'Achieves a polished, memorable celebration that fulfills all host expectations cleanly.',
        tags: ['classic', 'balanced', 'festive'],
      },
      {
        title: c3Title,
        tagline: 'High-impact signature memories and elevated visual aesthetics',
        summary: `An experience-led celebration emphasizing ${c3Title.toLowerCase()} visual grandeur and premium photo capture.`,
        palette: [...FIXED_PALETTES[2]!],
        experienceHighlights: [
          'Designer floral stage and dramatic ambient lighting',
          'Professional dual-camera photo and cinema video team',
          'Interactive dessert live counter and signature cocktails',
        ],
        qualityProfile: buildProfile('premium', 'premium', 'standard', 'essential'),
        tradeoffs: ['Invests heavily in visual memories while keeping sound and extras streamlined'],
        whyItFits: 'Creates unforgettable visual moments and keepsakes that will be cherished for decades.',
        tags: ['signature', 'premium', 'memorable'],
      },
    ],
  };
}
