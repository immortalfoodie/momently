import { z } from 'zod';

export const rainScenarioInputSchema = z.object({
  type: z.literal('rain'),
});

export const budgetCutScenarioInputSchema = z.object({
  type: z.literal('budget_cut'),
  percent: z.number().int().min(5).max(60),
});

export const guestSurgeScenarioInputSchema = z.object({
  type: z.literal('guest_surge'),
  extraGuests: z.number().int().min(1).max(1000),
});

export const vendorCancelsScenarioInputSchema = z.object({
  type: z.literal('vendor_cancels'),
  category: z.string().min(1).max(60),
});

export const lateStartScenarioInputSchema = z.object({
  type: z.literal('late_start'),
  delayMinutes: z.number().int().min(15).max(240),
  endLimitMinute: z.number().int().min(0).max(1439).optional(),
});

export const itemUnavailableScenarioInputSchema = z.object({
  type: z.literal('item_unavailable'),
  family: z.string().min(1).max(60),
});

export const chaosScenarioInputSchema = z.discriminatedUnion('type', [
  rainScenarioInputSchema,
  budgetCutScenarioInputSchema,
  guestSurgeScenarioInputSchema,
  vendorCancelsScenarioInputSchema,
  lateStartScenarioInputSchema,
  itemUnavailableScenarioInputSchema,
]);

export type RainScenarioInput = z.infer<typeof rainScenarioInputSchema>;
export type BudgetCutScenarioInput = z.infer<typeof budgetCutScenarioInputSchema>;
export type GuestSurgeScenarioInput = z.infer<typeof guestSurgeScenarioInputSchema>;
export type VendorCancelsScenarioInput = z.infer<typeof vendorCancelsScenarioInputSchema>;
export type LateStartScenarioInput = z.infer<typeof lateStartScenarioInputSchema>;
export type ItemUnavailableScenarioInput = z.infer<
  typeof itemUnavailableScenarioInputSchema
>;
export type ChaosScenarioInput = z.infer<typeof chaosScenarioInputSchema>;

export interface ChaosScenarioCatalogItem {
  type: ChaosScenarioInput['type'];
  label: string;
  description: string;
  defaultInput: ChaosScenarioInput;
}

export const CHAOS_SCENARIO_CATALOG: readonly ChaosScenarioCatalogItem[] = [
  {
    type: 'rain',
    label: 'Rain hits the outdoor event',
    description: 'Assess rain cover options or hold a backup indoor hall on standby',
    defaultInput: { type: 'rain' },
  },
  {
    type: 'budget_cut',
    label: 'Budget suddenly cut',
    description:
      'Reduce budget cap by 15% and recover savings while protecting key experiences',
    defaultInput: { type: 'budget_cut', percent: 15 },
  },
  {
    type: 'guest_surge',
    label: 'Guest count surge',
    description:
      'Accommodate surprise guests and assess seating, catering and budget impacts',
    defaultInput: { type: 'guest_surge', extraGuests: 25 },
  },
  {
    type: 'vendor_cancels',
    label: 'Key vendor cancels',
    description: 'Generate substitute vendor checklists and emergency requoting steps',
    defaultInput: { type: 'vendor_cancels', category: 'photography' },
  },
  {
    type: 'late_start',
    label: 'Timeline running late',
    description:
      'Shift, absorb or swap schedule slots to prevent late-night venue overtime',
    defaultInput: { type: 'late_start', delayMinutes: 45 },
  },
  {
    type: 'item_unavailable',
    label: 'Key item out of stock',
    description:
      'Substitute or reallocate rate-card items when a vendor runs out of inventory',
    defaultInput: { type: 'item_unavailable', family: 'decor_theme' },
  },
] as const;
