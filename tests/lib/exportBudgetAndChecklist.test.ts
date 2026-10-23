import { describe, expect, it } from 'vitest';
import { budgetTotal, getBudgetCap } from '@/engine/budget';
import { buildDemoPlan } from '@/engine/demo';
import { budgetCsv } from '@/lib/export/budgetCsv';
import { checklistCsv } from '@/lib/export/checklistCsv';
import { createIdFactory } from '@/lib/id';

const ctx = {
  ids: createIdFactory('export_budget_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('Export: Budget CSV & Checklist CSV', () => {
  it('budgetCsv includes N guests in header, matches row count, equals budgetTotal, and includes Budget cap row', () => {
    const { plan } = buildDemoPlan(ctx);
    const csv = budgetCsv(plan);
    const lines = csv.split('\r\n');

    // Header row + N budget items + 1 blank row + 1 Total row + 1 Budget cap row
    const expectedRowCount = 1 + plan.budgetItems.length + 1 + 1 + 1;
    expect(lines).toHaveLength(expectedRowCount);

    // Header includes actual guest count
    expect(lines[0]).toContain(`Total at ${plan.meta.guestCount} guests (INR)`);
    expect(lines[0]).toBe(
      `Category,Item,Basis,Unit price (INR),Quantity,Total at ${plan.meta.guestCount} guests (INR),Source,Locked,Note`,
    );

    // Sum item rows (column index 5) and compare with Total row and budgetTotal
    const totalExpected = budgetTotal(plan.budgetItems, plan.meta.guestCount);
    const totalRow = lines[lines.length - 2]!;
    const capRow = lines[lines.length - 1]!;

    expect(totalRow).toBe(`Total,,,,,${totalExpected},,,`);
    expect(capRow).toBe(`Budget cap,,,,,${getBudgetCap(plan.constraints)},,,`);
  });

  it('budgetCsv omits Budget cap row when no cap constraint exists', () => {
    const { plan } = buildDemoPlan(ctx);
    const planWithoutCap = {
      ...plan,
      constraints: plan.constraints.filter((c) => c.kind !== 'budget_cap'),
    };
    const csv = budgetCsv(planWithoutCap);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(1 + planWithoutCap.budgetItems.length + 2);
    expect(lines[lines.length - 1]!.startsWith('Total,')).toBe(true);
  });

  it('checklistCsv sorts tasks by due date (dated first), then priority, then title', () => {
    const { plan } = buildDemoPlan(ctx);
    const customPlan = {
      ...plan,
      meta: { ...plan.meta, dateIso: '2026-12-15' },
      tasks: [
        {
          id: 't1',
          title: 'Zeta task',
          category: 'decor',
          priority: 'low' as const,
          dueDaysBefore: 30,
          status: 'todo' as const,
        },
        {
          id: 't2',
          title: 'Beta task',
          category: 'venue',
          priority: 'high' as const,
          dueDaysBefore: 30,
          status: 'doing' as const,
        },
        {
          id: 't3',
          title: 'Alpha task',
          category: 'venue',
          priority: 'high' as const,
          dueDaysBefore: 30,
          status: 'todo' as const,
        },
        {
          id: 't4',
          title: 'Earliest task',
          category: 'planning',
          priority: 'low' as const,
          dueDaysBefore: 90,
          status: 'done' as const,
        },
      ],
    };

    const csv = checklistCsv(customPlan, ctx.clock());
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe(
      'Task,Category,Priority,Status,Due date,Days before event,Notes',
    );
    // 90 days before 2026-12-15 is earliest (2026-09-16)
    expect(lines[1]!.startsWith('Earliest task,planning,low,done,2026-09-16,90,')).toBe(
      true,
    );
    // Next are 30 days before (2026-11-15), high priority first, sorted alphabetically: Alpha then Beta, then low priority Zeta
    expect(lines[2]!.startsWith('Alpha task,venue,high,todo,2026-11-15,30,')).toBe(true);
    expect(lines[3]!.startsWith('Beta task,venue,high,doing,2026-11-15,30,')).toBe(true);
    expect(lines[4]!.startsWith('Zeta task,decor,low,todo,2026-11-15,30,')).toBe(true);
  });
});
