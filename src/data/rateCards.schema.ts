import { z } from 'zod';
import { CITY_TIERS, type CityTier } from '@/domain/constants';
import {
  budgetCategorySchema,
  moneySchema,
  QUALITY_ORDER,
  qualityLevelSchema,
  type QualityLevel,
} from '@/domain/schemas';

export { QUALITY_ORDER, qualityLevelSchema, type QualityLevel };

/**
 * Guest attendance band with capped attendance and corresponding flat fee.
 * WHY: Flat services scale with venue capacity brackets rather than per-head plate counts.
 */
export const guestBandSchema = z.object({
  maxGuests: z.number().int().positive().nullable(),
  cost: moneySchema,
});
export type GuestBand = z.infer<typeof guestBandSchema>;

const perGuestRateEntrySchema = z.object({
  key: z.string().min(1),
  family: z.string().min(1),
  category: budgetCategorySchema,
  label: z.string().min(1),
  quality: qualityLevelSchema,
  basis: z.literal('per_guest'),
  perGuestCost: moneySchema,
});

const flatRateEntrySchema = z.object({
  key: z.string().min(1),
  family: z.string().min(1),
  category: budgetCategorySchema,
  label: z.string().min(1),
  quality: qualityLevelSchema,
  basis: z.literal('flat'),
  bands: z.array(guestBandSchema).min(2),
});

function validateKeyMatch(
  entry: { key: string; family: string; quality: string },
  ctx: z.RefinementCtx,
): void {
  const expectedKey = `${entry.family}.${entry.quality}`;
  if (entry.key !== expectedKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `RateEntry key '${entry.key}' must equal '${expectedKey}'`,
      path: ['key'],
    });
  }
}

function validateTerminalBand(
  band: GuestBand,
  index: number,
  ctx: z.RefinementCtx,
): void {
  if (band.maxGuests !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The final guest band maxGuests must be null (unbounded)',
      path: ['bands', index, 'maxGuests'],
    });
  }
}

function validateIntermediateBand(
  band: GuestBand,
  previous: GuestBand | undefined,
  index: number,
  ctx: z.RefinementCtx,
): void {
  if (band.maxGuests === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only the final guest band may have null maxGuests',
      path: ['bands', index, 'maxGuests'],
    });
    return;
  }
  if (previous && previous.maxGuests !== null && band.maxGuests <= previous.maxGuests) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Guest bands maxGuests must be strictly ascending',
      path: ['bands', index, 'maxGuests'],
    });
  }
}

function validateBandCost(
  current: GuestBand,
  previous: GuestBand | undefined,
  index: number,
  ctx: z.RefinementCtx,
): void {
  if (previous && current.cost < previous.cost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Guest band costs must be non-decreasing',
      path: ['bands', index, 'cost'],
    });
  }
}

function validateFlatBands(bands: GuestBand[], ctx: z.RefinementCtx): void {
  const lastIndex = bands.length - 1;
  for (let i = 0; i <= lastIndex; i++) {
    const band = bands[i];
    if (!band) continue;
    const prev = i > 0 ? bands[i - 1] : undefined;

    if (i === lastIndex) {
      validateTerminalBand(band, i, ctx);
    } else {
      validateIntermediateBand(band, prev, i, ctx);
    }
    validateBandCost(band, prev, i, ctx);
  }
}

/**
 * Validated rate card entry for standard pricing models.
 * WHY: Discriminated union enforces distinct structures for per-guest catering vs stepped flat venue costs.
 */
export const rateEntrySchema = z
  .discriminatedUnion('basis', [perGuestRateEntrySchema, flatRateEntrySchema])
  .superRefine((entry, ctx) => {
    validateKeyMatch(entry, ctx);
    if (entry.basis === 'flat') {
      validateFlatBands(entry.bands, ctx);
    }
  });

export type RateEntry = z.infer<typeof rateEntrySchema>;

/**
 * Economic tier cost multipliers relative to tier 1 metros.
 * WHY: Normalizes base estimates across cities with different living costs without duplicate rate cards.
 */
export const CITY_TIER_MULTIPLIERS: Readonly<Record<CityTier, number>> = {
  tier1: 1,
  tier2: 0.8,
  tier3: 0.65,
};

export const cityTierMultiplierSchema = z.record(
  z.enum(CITY_TIERS),
  z.number().positive(),
);
export type CityTierMultiplier = z.infer<typeof cityTierMultiplierSchema>;
