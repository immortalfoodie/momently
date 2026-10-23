import type { EventPlan, Risk, VendorNeedStatus } from '@/domain/types';
import { type BudgetView, buildBudgetView } from '@/engine/budgetView';
import { deriveGuestMetrics } from '@/engine/guestMetrics';
import { scoreRisks } from '@/engine/risk';
import { buildScheduleView, type ScheduleViewReport } from '@/engine/scheduleView';
import { groupTasksByTimeframe, type TaskGroup } from '@/engine/taskDates';
import { formatInr, formatIsoDate, formatMinuteOfDay } from '@/lib/format';
import { PROVENANCE_TEXT_MAP } from './budgetCsv';

export const ESTIMATE_DISCLAIMER =
  'Prices are estimates unless marked Your input or Verified quote. They are not vendor quotes.';

export interface PlanDocumentConcept {
  title: string;
  tagline: string;
  summary: string;
}

export interface PlanDocumentVendor {
  category: string;
  status: VendorNeedStatus;
}

export interface PlanDocumentGuestCounts {
  total: number;
  servings: number;
  tables: number;
  households: number;
  vegetarian: number;
  jain: number;
  vegan: number;
  glutenFree: number;
  otherMeals: number;
  allergyAlerts: number;
  wheelchairUsers: number;
  elderly: number;
  children: number;
  quietSpaceNeeded: boolean;
  languages: string[];
}

export interface PlanDocument {
  title: string;
  subtitle: string;
  concept: PlanDocumentConcept | null;
  budget: BudgetView;
  schedule: ScheduleViewReport;
  checklist: TaskGroup[];
  vendors: PlanDocumentVendor[];
  guestCounts: PlanDocumentGuestCounts;
  topRisks: Risk[];
  assumptions: string[];
  disclaimers: string[];
}

const EMPTY_NEEDS = {
  allergyAlerts: 0,
  wheelchairUsers: 0,
  elderly: 0,
  children: 0,
  quietSpaceNeeded: false,
  languages: [] as string[],
};

function buildGuestCounts(plan: EventPlan): PlanDocumentGuestCounts {
  const metrics = deriveGuestMetrics(plan.meta.guestCount, plan.guestNeeds);
  const needs = plan.guestNeeds ?? EMPTY_NEEDS;
  return {
    total: plan.meta.guestCount,
    servings: metrics.servings,
    tables: metrics.tables,
    households: metrics.households,
    vegetarian: metrics.mealBreakdown.vegetarian,
    jain: metrics.mealBreakdown.jain,
    vegan: metrics.mealBreakdown.vegan,
    glutenFree: metrics.mealBreakdown.glutenFree,
    otherMeals: metrics.mealBreakdown.other,
    allergyAlerts: needs.allergyAlerts,
    wheelchairUsers: needs.wheelchairUsers,
    elderly: needs.elderly,
    children: needs.children,
    quietSpaceNeeded: Boolean(needs.quietSpaceNeeded),
    languages: [...needs.languages],
  };
}

function resolveConcept(plan: EventPlan): PlanDocumentConcept | null {
  if (!plan.selectedConceptId) return null;
  const found = plan.concepts.find((c) => c.id === plan.selectedConceptId);
  if (!found) return null;
  return {
    title: found.title,
    tagline: found.tagline,
    summary: found.summary,
  };
}

/**
 * Builds a structured, privacy-filtered PlanDocument from an EventPlan.
 *
 * PRIVACY & SAFETY (WHY):
 * Strictly omits personal contacts (`EventRecord.contacts`), the raw `hostBrief`,
 * and candidate vendor names or commercial quotes (`VendorNeed.quotes`).
 *
 * @param plan - Active EventPlan.
 * @param today - Reference Date for checklist timeframe bucketing and risk scoring.
 * @param extraAssumptions - Optional assumptions from the event record.
 * @returns Structured PlanDocument ready for printing or plain-text export.
 */
export function buildPlanDocument(
  plan: EventPlan,
  today: Date,
  extraAssumptions: readonly string[] = [],
): PlanDocument {
  const dateLabel = formatIsoDate(plan.meta.dateIso);
  const subtitle = `${plan.meta.type.toUpperCase()} • ${dateLabel} • ${plan.meta.city} • ${plan.meta.guestCount} guests • Setting: ${plan.meta.setting}`;

  const riskReport = scoreRisks(plan, {
    ids: (prefix) => `${prefix ?? 'id'}_doc`,
    clock: () => today,
  });

  const defaultAssumptions = [
    `Host city: ${plan.meta.city}`,
    'Catering servings include a 5% buffer above guest count',
    'Seating calculated at 8 seats per table; invitations at 3 guests per household',
  ];

  return {
    title: plan.meta.title,
    subtitle,
    concept: resolveConcept(plan),
    budget: buildBudgetView(plan),
    schedule: buildScheduleView(plan),
    checklist: groupTasksByTimeframe(plan, plan.tasks, today),
    vendors: plan.vendors.map((v) => ({ category: v.category, status: v.status })),
    guestCounts: buildGuestCounts(plan),
    topRisks: riskReport.risks.slice(0, 3),
    assumptions: [...defaultAssumptions, ...extraAssumptions],
    disclaimers: [
      ESTIMATE_DISCLAIMER,
      'Momently suggests; you decide. It never contacts vendors or guests: you do that yourself.',
    ],
  };
}

function formatBudgetLines(budget: BudgetView): string[] {
  const lines: string[] = [
    `Total: ${formatInr(budget.total)}${budget.cap !== null ? ` (Cap: ${formatInr(budget.cap)})` : ''}`,
  ];
  for (const cat of budget.categories) {
    lines.push(`  ${cat.label}: ${formatInr(cat.total)} (${cat.sharePercent}%)`);
    for (const entry of cat.items) {
      const prov = PROVENANCE_TEXT_MAP[entry.item.provenance];
      lines.push(`    - ${entry.item.label}: ${formatInr(entry.total)} [${prov}]`);
    }
  }
  return lines;
}

/**
 * Serializes a PlanDocument into a clean, readable plain-text summary.
 */
export function toPlainText(doc: PlanDocument): string {
  const lines: string[] = [doc.title, doc.subtitle, ''];

  if (doc.concept) {
    lines.push('CONCEPT', `${doc.concept.title} — ${doc.concept.tagline}`, doc.concept.summary, '');
  }

  lines.push('BUDGET', ...formatBudgetLines(doc.budget), '');

  lines.push('RUN OF SHOW');
  for (const s of doc.schedule.slots) {
    lines.push(
      `  ${formatMinuteOfDay(s.slot.startMinute)} - ${formatMinuteOfDay(s.endMinute)}: ${s.slot.title} (${s.slot.durationMinutes}m)`,
    );
  }
  lines.push('');

  lines.push('CHECKLIST');
  for (const group of doc.checklist) {
    lines.push(`  ${group.name}:`);
    for (const task of group.tasks) {
      lines.push(`    - [${task.status}] ${task.title} (${task.priority})`);
    }
  }
  lines.push('');

  lines.push('VENDORS');
  for (const v of doc.vendors) {
    lines.push(`  - ${v.category}: ${v.status.replace('_', ' ')}`);
  }
  lines.push('');

  lines.push(
    'GUEST COUNTS',
    `  Guests: ${doc.guestCounts.total} | Servings: ${doc.guestCounts.servings} | Tables: ${doc.guestCounts.tables}`,
    '',
    'DISCLAIMERS',
    ...doc.disclaimers.map((d) => `  * ${d}`),
    '',
    'Prepared with Momently',
  );

  return lines.join('\n');
}
