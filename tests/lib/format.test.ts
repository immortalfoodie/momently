import { describe, expect, it } from 'vitest';
import { formatInr, formatInrCompact, formatMinuteOfDay } from '@/lib/format';

describe('formatInr', () => {
  it('formats amounts according to the Indian numbering system', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(999)).toBe('₹999');
    expect(formatInr(1000)).toBe('₹1,000');
    expect(formatInr(99999)).toBe('₹99,999');
    expect(formatInr(100000)).toBe('₹1,00,000');
    expect(formatInr(150000)).toBe('₹1,50,000');
    expect(formatInr(1234567)).toBe('₹12,34,567');
    expect(formatInr(10000000)).toBe('₹1,00,00,000');
  });
});

describe('formatInrCompact', () => {
  it('formats amounts under 1 lakh with full precision grouping', () => {
    expect(formatInrCompact(0)).toBe('₹0');
    expect(formatInrCompact(999)).toBe('₹999');
    expect(formatInrCompact(1000)).toBe('₹1,000');
    expect(formatInrCompact(45000)).toBe('₹45,000');
    expect(formatInrCompact(99999)).toBe('₹99,999');
  });

  it('formats amounts in lakhs and crores concisely', () => {
    expect(formatInrCompact(100000)).toBe('₹1 lakh');
    expect(formatInrCompact(150000)).toBe('₹1.5 lakh');
    expect(formatInrCompact(1234567)).toBe('₹12.35 lakh');
    expect(formatInrCompact(10000000)).toBe('₹1 crore');
    expect(formatInrCompact(20000000)).toBe('₹2 crore');
  });
});

describe('formatMinuteOfDay', () => {
  it('formats minute numbers into 12-hour AM/PM times', () => {
    expect(formatMinuteOfDay(0)).toBe('12:00 AM');
    expect(formatMinuteOfDay(60)).toBe('1:00 AM');
    expect(formatMinuteOfDay(450)).toBe('7:30 AM');
    expect(formatMinuteOfDay(720)).toBe('12:00 PM');
    expect(formatMinuteOfDay(1170)).toBe('7:30 PM');
    expect(formatMinuteOfDay(1439)).toBe('11:59 PM');
  });
});
