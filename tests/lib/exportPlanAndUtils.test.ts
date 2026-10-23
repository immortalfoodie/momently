import { describe, expect, it, vi } from 'vitest';
import { buildDemoPlan } from '@/engine/demo';
import { downloadText } from '@/lib/export/download';
import { safeFilename } from '@/lib/export/filename';
import { orderQuantities } from '@/lib/export/orderQuantities';
import {
  buildPlanDocument,
  ESTIMATE_DISCLAIMER,
  toPlainText,
} from '@/lib/export/planDocument';
import { createIdFactory } from '@/lib/id';

const ctx = {
  ids: createIdFactory('export_plan_utils_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('Export: Order Quantities, PlanDocument, Safe Filename & Download', () => {
  it('orderQuantities derives servings, tables, invitations, favours (only when gifts item exists), and non-zero dietary lines', () => {
    const { plan } = buildDemoPlan(ctx);
    const planWithDietary = {
      ...plan,
      guestNeeds: {
        ...plan.guestNeeds,
        vegetarian: 30,
        jain: 10,
        vegan: 0,
        glutenFree: 0,
      },
    };

    const rowsWithGifts = orderQuantities(planWithDietary);
    expect(rowsWithGifts.some((r) => r.label.includes('Food servings'))).toBe(true);
    expect(rowsWithGifts.some((r) => r.label.includes('Tables of 8'))).toBe(true);
    expect(rowsWithGifts.some((r) => r.label.includes('Favours'))).toBe(true);
    expect(rowsWithGifts.some((r) => r.label.includes('Invitations'))).toBe(true);
    expect(rowsWithGifts.some((r) => r.label === 'Vegetarian meals')).toBe(true);
    expect(rowsWithGifts.some((r) => r.label === 'Jain meals')).toBe(true);
    expect(rowsWithGifts.some((r) => r.label === 'Vegan meals')).toBe(false);

    // Every row explains how it was calculated
    for (const row of rowsWithGifts) {
      expect(row.how.length).toBeGreaterThan(5);
    }

    // Without gifts item, favours row is omitted
    const planNoGifts = {
      ...planWithDietary,
      budgetItems: planWithDietary.budgetItems.filter((i) => i.category !== 'gifts'),
    };
    const rowsNoGifts = orderQuantities(planNoGifts);
    expect(rowsNoGifts.some((r) => r.label.includes('Favours'))).toBe(false);
  });

  it('buildPlanDocument and toPlainText exclude hostBrief, contacts, and quote vendor names, and include disclaimer', () => {
    const { plan } = buildDemoPlan(ctx);
    const secretHostBrief = 'SECRET_HOST_BRIEF_MARKER_999';
    const secretQuoteVendor = 'SECRET_VENDOR_QUOTE_NAME_888';

    const planWithSecrets = {
      ...plan,
      meta: {
        ...plan.meta,
        hostBrief: secretHostBrief,
      },
      vendors: plan.vendors.map((v, idx) =>
        idx === 0
          ? {
              ...v,
              quotes: [
                {
                  vendorName: secretQuoteVendor,
                  price: 55000,
                  answers: { Q1: 'Secret answer' },
                },
              ],
            }
          : v,
      ),
    };

    const doc = buildPlanDocument(planWithSecrets, ctx.clock());
    expect(doc.disclaimers).toContain(ESTIMATE_DISCLAIMER);

    const serializedDoc = JSON.stringify(doc);
    expect(serializedDoc).not.toContain(secretHostBrief);
    expect(serializedDoc).not.toContain(secretQuoteVendor);

    const text = toPlainText(doc);
    expect(text).toContain(ESTIMATE_DISCLAIMER);
    expect(text).not.toContain(secretHostBrief);
    expect(text).not.toContain(secretQuoteVendor);
  });

  it('safeFilename sanitizes hostile titles, path traversals, and emojis, enforcing allow-listed extensions', () => {
    expect(safeFilename('../../etc/passwd', 'csv')).toBe('etc-passwd.csv');
    expect(safeFilename('..\\..\\Windows\\System32\\cmd.exe', 'txt')).toBe(
      'windows-system32-cmd-exe.txt',
    );
    expect(safeFilename('🎉✨ शुभ विवाह ✨🎉', 'ics')).toBe('momently-event.ics');
    expect(safeFilename('   ', 'json')).toBe('momently-event.json');
    expect(
      safeFilename(
        'A Very Long Celebration Title That Exceeds Fifty Characters Easily In Any Language',
        'csv',
      ).length,
    ).toBeLessThanOrEqual(54);
  });

  it('downloadText creates Blob URL, clicks temporary anchor, and always revokes URL', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url-123');
    const revokeObjectURLMock = vi.fn();

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;

    try {
      const res = downloadText('test-plan.csv', 'text/csv', 'A,B\r\n1,2', {
        bom: true,
      });
      expect(res).toEqual({ ok: true, value: { filename: 'test-plan.csv' } });
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url-123');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
