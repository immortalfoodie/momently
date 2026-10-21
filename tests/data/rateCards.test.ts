import { describe, expect, it } from 'vitest';
import { getRate, getRateByKey, listFamilies, RATE_CARDS } from '@/data/rateCards';
import type { GuestBand } from '@/data/rateCards.schema';
import { rateEntrySchema } from '@/data/rateCards.schema';

function verifyPerGuestMonotonic(family: string): void {
  const essential = getRate(family, 'essential');
  const standard = getRate(family, 'standard');
  const premium = getRate(family, 'premium');

  if (
    essential?.basis !== 'per_guest' ||
    standard?.basis !== 'per_guest' ||
    premium?.basis !== 'per_guest'
  ) {
    return;
  }

  expect(essential.perGuestCost).toBeLessThanOrEqual(standard.perGuestCost);
  expect(standard.perGuestCost).toBeLessThanOrEqual(premium.perGuestCost);
}

function verifyBandCostPair(eb: GuestBand, sb: GuestBand, pb: GuestBand): void {
  expect(eb.maxGuests).toBe(sb.maxGuests);
  expect(sb.maxGuests).toBe(pb.maxGuests);
  expect(eb.cost).toBeLessThanOrEqual(sb.cost);
  expect(sb.cost).toBeLessThanOrEqual(pb.cost);
}

function verifyFlatBandsMonotonic(family: string): void {
  const essential = getRate(family, 'essential');
  const standard = getRate(family, 'standard');
  const premium = getRate(family, 'premium');

  if (!essential || essential.basis !== 'flat') return;
  if (!standard || standard.basis !== 'flat') return;
  if (!premium || premium.basis !== 'flat') return;

  expect(essential.bands.length).toBe(standard.bands.length);
  expect(standard.bands.length).toBe(premium.bands.length);

  essential.bands.forEach((eb, index) => {
    const sb = standard.bands[index];
    const pb = premium.bands[index];
    if (sb && pb) {
      verifyBandCostPair(eb, sb, pb);
    }
  });
}

function verifyBandSequence(bands: GuestBand[]): void {
  const lastIndex = bands.length - 1;
  expect(bands.length).toBeGreaterThanOrEqual(2);
  expect(bands[lastIndex]?.maxGuests).toBeNull();

  for (let i = 0; i < lastIndex; i++) {
    const current = bands[i];
    expect(current?.maxGuests).not.toBeNull();
    const previous = i > 0 ? bands[i - 1] : undefined;
    if (current?.maxGuests && previous?.maxGuests) {
      expect(current.maxGuests).toBeGreaterThan(previous.maxGuests);
    }
  }
}

describe('Rate Cards Data Layer', () => {
  it('ensures every rate entry passes the schema and has a valid key format', () => {
    expect(RATE_CARDS.length).toBeGreaterThan(0);
    for (const entry of RATE_CARDS) {
      expect(() => rateEntrySchema.parse(entry)).not.toThrow();
      expect(entry.key).toBe(`${entry.family}.${entry.quality}`);
    }
  });

  it('verifies all rate card keys are completely unique', () => {
    const keys = RATE_CARDS.map((entry) => entry.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('validates quality costs are monotonic for per-guest and flat rates', () => {
    const families = listFamilies();
    for (const family of families) {
      verifyPerGuestMonotonic(family);
      verifyFlatBandsMonotonic(family);
    }
  });

  it('ensures band maxGuests strictly ascend and the final band is null', () => {
    const flatEntries = RATE_CARDS.filter((entry) => entry.basis === 'flat');
    expect(flatEntries.length).toBeGreaterThan(0);

    for (const entry of flatEntries) {
      if (entry.basis === 'flat') {
        verifyBandSequence(entry.bands);
      }
    }
  });

  it('retrieves entries via getRate and getRateByKey', () => {
    const venue = getRate('venue_hall', 'standard');
    expect(venue).toBeDefined();
    expect(venue?.family).toBe('venue_hall');
    expect(venue?.quality).toBe('standard');

    const byKey = getRateByKey('venue_hall.standard');
    expect(byKey).toEqual(venue);

    expect(getRate('unknown_family', 'essential')).toBeUndefined();
    expect(getRateByKey('invalid.key')).toBeUndefined();
  });

  it('rejects rate entries with key mismatch or invalid bands', () => {
    expect(() =>
      rateEntrySchema.parse({
        key: 'wrong.key',
        family: 'venue_hall',
        category: 'venue',
        label: 'Hall',
        quality: 'essential',
        basis: 'per_guest',
        perGuestCost: 1000,
      }),
    ).toThrow();

    expect(() =>
      rateEntrySchema.parse({
        key: 'venue_hall.essential',
        family: 'venue_hall',
        category: 'venue',
        label: 'Hall',
        quality: 'essential',
        basis: 'flat',
        bands: [
          { maxGuests: 100, cost: 20000 },
          { maxGuests: 50, cost: 25000 },
          { maxGuests: null, cost: 30000 },
        ],
      }),
    ).toThrow();
  });
});
