import { describe, expect, it } from 'vitest';
import { getRate } from '@/data/rateCards';
import { itemFromRate, priceRate, tierForCity } from '@/engine/pricing';

describe('Pricing Engine', () => {
  it('resolves city tiers case-insensitively with trimming and defaults unknown cities to tier2', () => {
    expect(tierForCity('Mumbai')).toBe('tier1');
    expect(tierForCity('  mumbai  ')).toBe('tier1');
    expect(tierForCity('DELHI')).toBe('tier1');
    expect(tierForCity('Bengaluru')).toBe('tier1');
    expect(tierForCity('Pune')).toBe('tier1');
    expect(tierForCity('Jaipur')).toBe('tier2');
    expect(tierForCity('lucknow')).toBe('tier2');
    expect(tierForCity('Unknown Small Town')).toBe('tier2');
    expect(tierForCity('')).toBe('tier2');
  });

  it('selects flat bands at exact boundaries (50, 51, 100, 101)', () => {
    const venueEntry = getRate('venue_hall', 'standard');
    expect(venueEntry).toBeDefined();
    if (!venueEntry || venueEntry.basis !== 'flat') return;

    const cost50 = priceRate(venueEntry, { guestCount: 50, tier: 'tier1' });
    const cost51 = priceRate(venueEntry, { guestCount: 51, tier: 'tier1' });
    const cost100 = priceRate(venueEntry, { guestCount: 100, tier: 'tier1' });
    const cost101 = priceRate(venueEntry, { guestCount: 101, tier: 'tier1' });

    expect(cost50).toBe(21000);
    expect(cost51).toBe(30000);
    expect(cost100).toBe(30000);
    expect(cost101).toBe(40500);

    expect(cost50).toBeLessThan(cost51);
    expect(cost51).toBe(cost100);
    expect(cost100).toBeLessThan(cost101);
  });

  it('ensures priced outputs are always non-negative integers', () => {
    const buffetEntry = getRate('catering_buffet', 'standard');
    expect(buffetEntry).toBeDefined();
    if (!buffetEntry) return;

    const costTier1 = priceRate(buffetEntry, {
      guestCount: 83,
      tier: 'tier1',
      categoryMultiplier: 1.3,
    });
    const costTier3 = priceRate(buffetEntry, {
      guestCount: 83,
      tier: 'tier3',
      categoryMultiplier: 1.3,
    });

    expect(Number.isInteger(costTier1)).toBe(true);
    expect(Number.isInteger(costTier3)).toBe(true);
    expect(costTier1).toBeGreaterThan(0);
    expect(costTier3).toBeGreaterThan(0);
  });

  it('generates a valid BudgetItem template from a rate entry', () => {
    const buffet = getRate('catering_buffet', 'standard');
    expect(buffet).toBeDefined();
    if (!buffet) return;

    const item = itemFromRate(buffet, { guestCount: 80, tier: 'tier1' });
    expect(item.basis).toBe('per_guest');
    expect(item.quantity).toBe(1);
    expect(item.unitCost).toBe(900);
    expect(item.provenance).toBe('estimate');
    expect(item.locked).toBe(false);
    expect(item.rateKey).toBe('catering_buffet.standard');
  });
});
