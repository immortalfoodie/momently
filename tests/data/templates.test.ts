import { describe, expect, it } from 'vitest';
import { getRate } from '@/data/rateCards';
import { QUALITY_ORDER } from '@/data/rateCards.schema';
import { eventTemplateSchema } from '@/data/templates';
import { getTemplate, TEMPLATES } from '@/data/templates';
import { EVENT_TYPE_IDS } from '@/domain/constants';

describe('Event Templates Data Layer', () => {
  it('validates all registered event templates against eventTemplateSchema', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);
      expect(template).toBeDefined();
      expect(() => eventTemplateSchema.parse(template)).not.toThrow();
    }
  });

  it('ensures every line-item and downgrade family exists in RATE_CARDS at all quality tiers', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);

      const allFamilies = new Set([
        ...template.lineItems.map((item) => item.family),
        ...template.downgradeOrder,
      ]);

      for (const family of allFamilies) {
        for (const quality of QUALITY_ORDER) {
          const rate = getRate(family, quality);
          expect(rate).toBeDefined();
        }
      }
    }
  });

  it('ensures downgradeOrder contains only families present in that template lineItems', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);
      const lineItemFamilies = new Set(template.lineItems.map((item) => item.family));

      for (const downgradeFamily of template.downgradeOrder) {
        expect(lineItemFamilies.has(downgradeFamily)).toBe(true);
      }
    }
  });

  it('verifies schedule offsets are non-decreasing and the entire schedule fits within one day', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);
      let previousOffset = -1;

      for (const slot of template.schedule) {
        expect(slot.offsetMinutes).toBeGreaterThanOrEqual(previousOffset);
        previousOffset = slot.offsetMinutes;

        const totalSlotEnd =
          template.defaultStartMinute + slot.offsetMinutes + slot.durationMinutes;
        expect(totalSlotEnd).toBeLessThanOrEqual(1440);
      }
    }
  });

  it('ensures task titles are unique within each template', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);
      const titles = template.tasks.map((task) => task.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    }
  });

  it('ensures vendor need categories are unique within each template', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);
      const categories = template.vendors.map((vendor) => vendor.category);
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBe(categories.length);
    }
  });

  it('verifies vendor needs have 4-7 requirements and 5-8 questionsToAsk', () => {
    for (const type of EVENT_TYPE_IDS) {
      const template = getTemplate(type);
      for (const vendor of template.vendors) {
        expect(vendor.requirements.length).toBeGreaterThanOrEqual(4);
        expect(vendor.requirements.length).toBeLessThanOrEqual(7);
        expect(vendor.questionsToAsk.length).toBeGreaterThanOrEqual(5);
        expect(vendor.questionsToAsk.length).toBeLessThanOrEqual(8);
      }
    }
  });

  it('verifies wedding-specific requirements', () => {
    const wedding = TEMPLATES.wedding;
    expect(wedding.contingencyBasePercent).toBe(10);
    expect(wedding.categoryMultipliers?.venue).toBe(3);
    expect(wedding.categoryMultipliers?.decor).toBe(3);
    expect(wedding.categoryMultipliers?.photography).toBe(3);
    expect(wedding.categoryMultipliers?.entertainment).toBe(2.5);
    expect(wedding.categoryMultipliers?.food).toBe(1.3);
    expect(wedding.categoryMultipliers?.transport).toBe(2);
    expect(wedding.schedule.length).toBeGreaterThanOrEqual(8);
    expect(wedding.schedule.length).toBeLessThanOrEqual(10);
    expect(wedding.tasks.length).toBeGreaterThanOrEqual(14);
    expect(wedding.tasks.length).toBeLessThanOrEqual(18);
    expect(wedding.vendors.length).toBeGreaterThanOrEqual(5);
    expect(wedding.vendors.length).toBeLessThanOrEqual(6);
  });

  it('verifies birthday-specific requirements', () => {
    const birthday = TEMPLATES.birthday;
    expect(birthday.contingencyBasePercent).toBe(7);
    expect(birthday.schedule.length).toBeGreaterThanOrEqual(6);
    expect(birthday.schedule.length).toBeLessThanOrEqual(8);
    expect(birthday.tasks.length).toBeGreaterThanOrEqual(10);
    expect(birthday.tasks.length).toBeLessThanOrEqual(12);
    expect(birthday.vendors.length).toBeGreaterThanOrEqual(4);
    expect(birthday.vendors.length).toBeLessThanOrEqual(5);
  });

  it('verifies anniversary-specific requirements including tribute slot', () => {
    const anniversary = TEMPLATES.anniversary;
    expect(anniversary.contingencyBasePercent).toBe(8);
    expect(anniversary.schedule.length).toBeGreaterThanOrEqual(7);
    expect(anniversary.schedule.length).toBeLessThanOrEqual(9);
    expect(anniversary.tasks.length).toBeGreaterThanOrEqual(10);
    expect(anniversary.tasks.length).toBeLessThanOrEqual(12);
    expect(anniversary.vendors.length).toBeGreaterThanOrEqual(4);
    expect(anniversary.vendors.length).toBeLessThanOrEqual(5);

    const hasTributeSlot = anniversary.schedule.some((slot) =>
      slot.title.toLowerCase().includes('tribute'),
    );
    expect(hasTributeSlot).toBe(true);
  });

  it('verifies community-specific requirements', () => {
    const community = TEMPLATES.community;
    expect(community.contingencyBasePercent).toBe(10);
    expect(community.categoryMultipliers?.venue).toBe(0.5);
    expect(community.categoryMultipliers?.food).toBe(1);

    const lineFamilies = community.lineItems.map((item) => item.family);
    expect(lineFamilies).toContain('catering_snacks');
    expect(lineFamilies).not.toContain('catering_buffet');

    const permits = community.lineItems.find(
      (item) => item.family === 'permits_licences',
    );
    const volunteerKit = community.lineItems.find(
      (item) => item.family === 'volunteer_kit',
    );
    expect(permits?.required).toBe(true);
    expect(volunteerKit?.required).toBe(true);
  });
});
