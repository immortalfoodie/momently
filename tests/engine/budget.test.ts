import { describe, expect, it } from 'vitest';
import { BUDGET_CATEGORY_IDS } from '@/domain/constants';
import type { BudgetItem, Constraint, EventPlan } from '@/domain/types';
import {
  budgetTotal,
  categoryTotals,
  contingencyPercent,
  getBudgetCap,
  getBudgetStatus,
  itemTotal,
  provenanceBreakdown,
  refreshContingency,
} from '@/engine/budget';

describe('Budget Engine', () => {
  const sampleItems: BudgetItem[] = [
    {
      id: 'bi_1',
      category: 'venue',
      label: 'Banquet Hall',
      basis: 'flat',
      unitCost: 30000,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
    },
    {
      id: 'bi_2',
      category: 'food',
      label: 'Dinner Buffet',
      basis: 'per_guest',
      unitCost: 800,
      quantity: 1,
      provenance: 'estimate',
      locked: false,
    },
    {
      id: 'bi_3',
      category: 'decor',
      label: 'Theme Decor',
      basis: 'flat',
      unitCost: 15000,
      quantity: 1,
      provenance: 'user',
      locked: true,
    },
  ];

  it('calculates itemTotal correctly for per_guest vs flat items', () => {
    expect(itemTotal(sampleItems[0]!, 100)).toBe(30000);
    expect(itemTotal(sampleItems[1]!, 100)).toBe(80000);
    expect(itemTotal(sampleItems[1]!, 50)).toBe(40000);
  });

  it('calculates overall budget total', () => {
    expect(budgetTotal(sampleItems, 100)).toBe(125000);
    expect(budgetTotal(sampleItems, 50)).toBe(85000);
  });

  it('returns zero-filled category totals across all budget categories', () => {
    const cats = categoryTotals(sampleItems, 100);
    for (const categoryId of BUDGET_CATEGORY_IDS) {
      expect(cats[categoryId]).toBeDefined();
    }
    expect(cats.venue).toBe(30000);
    expect(cats.food).toBe(80000);
    expect(cats.decor).toBe(15000);
    expect(cats.photography).toBe(0);
    expect(cats.entertainment).toBe(0);
    expect(cats.contingency).toBe(0);
  });

  it('prioritizes hard budget caps over soft caps and selects the lowest hard cap', () => {
    const constraints: Constraint[] = [
      {
        id: 'c_soft_1',
        kind: 'budget_cap',
        severity: 'soft',
        description: 'Target cap',
        numericValue: 120000,
      },
      {
        id: 'c_hard_1',
        kind: 'budget_cap',
        severity: 'hard',
        description: 'Hard cap 1',
        numericValue: 150000,
      },
      {
        id: 'c_hard_2',
        kind: 'budget_cap',
        severity: 'hard',
        description: 'Hard cap 2',
        numericValue: 140000,
      },
    ];

    expect(getBudgetCap(constraints)).toBe(140000);

    const softOnly: Constraint[] = [
      {
        id: 'c_soft_2',
        kind: 'budget_cap',
        severity: 'soft',
        description: 'Soft 1',
        numericValue: 100000,
      },
      {
        id: 'c_soft_3',
        kind: 'budget_cap',
        severity: 'soft',
        description: 'Soft 2',
        numericValue: 90000,
      },
    ];
    expect(getBudgetCap(softOnly)).toBe(90000);
    expect(getBudgetCap([])).toBeNull();
  });

  it('derives comprehensive budget status and used percentage', () => {
    const mockPlan = {
      meta: { guestCount: 100 },
      budgetItems: sampleItems,
      constraints: [
        {
          id: 'c_cap',
          kind: 'budget_cap',
          severity: 'hard',
          description: 'Max budget',
          numericValue: 200000,
        },
      ],
    } as unknown as EventPlan;

    const status = getBudgetStatus(mockPlan);
    expect(status.total).toBe(125000);
    expect(status.cap).toBe(200000);
    expect(status.remaining).toBe(75000);
    expect(status.overCap).toBe(false);
    expect(status.usedPercent).toBe(62.5);
  });

  it('computes provenance breakdown', () => {
    const breakdown = provenanceBreakdown(sampleItems, 100);
    expect(breakdown.estimate).toBe(110000);
    expect(breakdown.user).toBe(15000);
    expect(breakdown.verified).toBe(0);
  });

  it('calculates contingency percentage with weather risk uplifts', () => {
    expect(contingencyPercent('wedding', 'indoor')).toBe(10);
    expect(contingencyPercent('wedding', 'outdoor')).toBe(13);
    expect(contingencyPercent('wedding', 'mixed')).toBe(12);
    expect(contingencyPercent('birthday', 'indoor')).toBe(7);
    expect(contingencyPercent('anniversary', 'outdoor')).toBe(11);
  });

  it('refreshes contingency keeping exactly one contingency item', () => {
    const refreshed = refreshContingency(sampleItems, 100, 10);
    const contingencyItems = refreshed.filter((item) => item.category === 'contingency');
    expect(contingencyItems).toHaveLength(1);
    expect(contingencyItems[0]?.unitCost).toBe(12500);

    const reRefreshed = refreshContingency(refreshed, 100, 10);
    expect(reRefreshed.filter((item) => item.category === 'contingency')).toHaveLength(1);
  });

  it('leaves user-locked contingency item untouched', () => {
    const lockedContingencyItem: BudgetItem = {
      id: 'bi_custom_contingency',
      category: 'contingency',
      label: 'Host Emergency Fund',
      basis: 'flat',
      unitCost: 25000,
      quantity: 1,
      provenance: 'user',
      locked: true,
    };
    const itemsWithLocked = [...sampleItems, lockedContingencyItem];
    const result = refreshContingency(itemsWithLocked, 100, 10);
    const item = result.find((i) => i.id === 'bi_custom_contingency');
    expect(item?.unitCost).toBe(25000);
    expect(item?.locked).toBe(true);
  });
});
