import type { EventPlan, VendorNeed } from '@/domain/types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday celebration',
  anniversary: 'Anniversary celebration',
  community: 'Community event',
};

/**
 * Builds a plain-text vendor request brief that hosts can copy and send directly to vendors.
 * WHY: Enables hosts to request quotes with complete operational context without revealing internal
 * budgets, caps, contact names, or host notes.
 *
 * @param plan - Current EventPlan.
 * @param need - Targeted VendorNeed category.
 * @returns Self-contained plain-text vendor inquiry brief.
 */
export function buildVendorBrief(plan: EventPlan, need: VendorNeed): string {
  const typeLabel =
    EVENT_TYPE_LABELS[plan.meta.type] ??
    plan.meta.type.charAt(0).toUpperCase() + plan.meta.type.slice(1);
  const dateStr = plan.meta.dateIso ?? 'date to be confirmed';
  const settingStr =
    plan.meta.setting !== 'undecided' ? `Setting: ${plan.meta.setting}` : undefined;

  const lines: string[] = [
    `Event: ${typeLabel}`,
    `Date: ${dateStr}`,
    `Location: ${plan.meta.city}`,
    `Guest count: ${plan.meta.guestCount} guests`,
  ];

  if (settingStr) {
    lines.push(settingStr);
  }

  lines.push('');
  lines.push('Requirements:');
  if (need.requirements.length > 0) {
    for (const req of need.requirements) {
      lines.push(`- ${req}`);
    }
  } else {
    lines.push('- Standard services for this category');
  }

  if (need.questionsToAsk.length > 0) {
    lines.push('');
    lines.push('Questions for your quote:');
    need.questionsToAsk.forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q}`);
    });
  }

  lines.push('');
  lines.push(
    'Please share a written quote that covers the points above, including taxes, overtime and cancellation terms.',
  );

  return lines.join('\n');
}
