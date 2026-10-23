import type { EventPlan, GuestNeeds, PlanPatchOp, TaskPriority } from '@/domain/types';
import { isAccessUnconfirmed } from './conflictRules';
import type { EngineContext } from './context';

export type GuestInsightSeverity = 'important' | 'suggested';

export interface InsightTaskTemplate {
  title: string;
  category: string;
  dueDaysBefore: number;
  priority: TaskPriority;
}

export interface GuestInsight {
  id: string;
  severity: GuestInsightSeverity;
  title: string;
  detail: string;
  task?: InsightTaskTemplate;
}

interface InsightRule {
  active: (needs: GuestNeeds, plan: EventPlan) => boolean;
  create: (needs: GuestNeeds) => GuestInsight;
}

const INSIGHT_RULES: InsightRule[] = [
  {
    active: (n, p) => n.wheelchairUsers > 0 && isAccessUnconfirmed(p),
    create: () => ({
      id: 'insight_accessibility',
      severity: 'important',
      title: 'Step-free access & accessible restrooms',
      detail:
        'Verify a step-free route from entrance to dining area and restrooms, and confirm accessible restroom facilities.',
      task: {
        title:
          'Verify a step-free route from entrance to dining area and restrooms before confirming the venue',
        category: 'accessibility',
        dueDaysBefore: 60,
        priority: 'high',
      },
    }),
  },
  {
    active: (n) => n.elderly > 0,
    create: () => ({
      id: 'insight_elderly',
      severity: 'suggested',
      title: 'Comfort and seating for senior guests',
      detail:
        'Ensure reserved seating near the entrance and restrooms, adequate chairs throughout, and shade or a quiet rest area.',
      task: {
        title: 'Arrange priority seating near entrance and restrooms for elderly guests',
        category: 'venue',
        dueDaysBefore: 14,
        priority: 'medium',
      },
    }),
  },
  {
    active: (n) => n.children > 0,
    create: () => ({
      id: 'insight_children',
      severity: 'suggested',
      title: 'Child-friendly spaces and dining',
      detail:
        'Plan a kids’ menu, child-friendly activities, and ensure a safe play space positioned away from open flames and decor.',
      task: {
        title: 'Coordinate kids menu and child-safe activity area with caterer and venue',
        category: 'catering',
        dueDaysBefore: 14,
        priority: 'medium',
      },
    }),
  },
  {
    active: (n) => n.jain > 0,
    create: () => ({
      id: 'insight_jain',
      severity: 'important',
      title: 'Separate Jain food preparation & labeling',
      detail:
        'Confirm dedicated preparation space with the caterer and clearly label all Jain dishes on the buffet.',
      task: {
        title: 'Confirm separate kitchen preparation and buffet labeling for Jain meals',
        category: 'catering',
        dueDaysBefore: 14,
        priority: 'high',
      },
    }),
  },
  {
    active: (n) => n.vegan > 0,
    create: () => ({
      id: 'insight_vegan',
      severity: 'suggested',
      title: 'Vegan menu segregation',
      detail:
        'Confirm dedicated plant-based menu items and cross-contamination prevention protocols with the caterer.',
      task: {
        title: 'Confirm 100% plant-based menu items and cross-contact handling with caterer',
        category: 'catering',
        dueDaysBefore: 14,
        priority: 'medium',
      },
    }),
  },
  {
    active: (n) => n.glutenFree > 0,
    create: () => ({
      id: 'insight_gluten_free',
      severity: 'suggested',
      title: 'Gluten-free menu verification',
      detail:
        'Verify gluten-free menu offerings and ensure separate serving utensils and preparation surfaces with the caterer.',
      task: {
        title: 'Confirm gluten-free menu items and handling protocols with caterer',
        category: 'catering',
        dueDaysBefore: 14,
        priority: 'medium',
      },
    }),
  },
  {
    active: (n) => n.allergyAlerts > 0,
    create: () => ({
      id: 'insight_allergies',
      severity: 'important',
      title: 'Allergy management protocols',
      detail:
        'Ask the caterer for written ingredient lists and separate preparation; keep a list of who needs notice without storing personal names here.',
      task: {
        title: 'Obtain written ingredient lists and separate preparation protocol for allergy alerts',
        category: 'catering',
        dueDaysBefore: 14,
        priority: 'high',
      },
    }),
  },
  {
    active: (n) => Boolean(n.quietSpaceNeeded),
    create: () => ({
      id: 'insight_quiet_space',
      severity: 'suggested',
      title: 'Designate a quiet retreat space',
      detail:
        'Identify a quiet room or low-sensory corner away from loud speakers and inform attending guests where it is located.',
      task: {
        title: 'Identify and designate a quiet retreat room or corner at the venue',
        category: 'venue',
        dueDaysBefore: 7,
        priority: 'medium',
      },
    }),
  },
  {
    active: (n) => n.languages.length > 1,
    create: (n) => ({
      id: 'insight_languages',
      severity: 'suggested',
      title: 'Multilingual communication',
      detail: `Plan key announcements or printed materials in ${n.languages.join(' & ')} so all guests stay comfortably informed.`,
      task: {
        title: 'Prepare bilingual announcements or printed itineraries for diverse languages',
        category: 'planning',
        dueDaysBefore: 7,
        priority: 'medium',
      },
    }),
  },
];

/**
 * Deterministically generates actionable hospitality insights from aggregated guest requirements.
 * WHY: Translates demographic numbers into concrete operational duties without assuming religion,
 * culture, or financial details.
 *
 * @param plan - The active EventPlan.
 * @returns Array of tailored guest hospitality insights.
 */
export function guestInsights(plan: EventPlan): GuestInsight[] {
  const needs = plan.guestNeeds;
  if (!needs) return [];

  const results: GuestInsight[] = [];
  for (const rule of INSIGHT_RULES) {
    if (rule.active(needs, plan)) {
      results.push(rule.create(needs));
    }
  }
  return results;
}

/**
 * Creates an idempotent add_task patch operation for a guest insight.
 * WHY: Returns undefined if an identical task already exists in the plan, preventing task spam.
 */
export function insightTaskOps(
  plan: EventPlan,
  insight: GuestInsight,
  ctx: EngineContext,
): PlanPatchOp | undefined {
  if (!insight.task) return undefined;

  const targetTitle = insight.task.title.toLowerCase();
  const alreadyExists = plan.tasks.some(
    (t) => t.title.toLowerCase() === targetTitle,
  );
  if (alreadyExists) return undefined;

  return {
    type: 'add_task',
    task: {
      id: ctx.ids('task'),
      title: insight.task.title,
      category: insight.task.category,
      dueDaysBefore: insight.task.dueDaysBefore,
      status: 'todo',
      priority: insight.task.priority,
    },
  };
}
