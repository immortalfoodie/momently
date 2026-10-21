import type { EventType } from '@/domain/types';
import { anniversaryTemplate } from './anniversary';
import { birthdayTemplate } from './birthday';
import { communityTemplate } from './community';
import type { EventTemplate } from './types';
import { weddingTemplate } from './wedding';

export * from './anniversary';
export * from './birthday';
export * from './community';
export * from './types';
export * from './wedding';

/**
 * Registry of event templates keyed by their unique domain event type.
 * WHY: Provides deterministic baseline plans with predefined line items, tasks, and schedules.
 */
export const TEMPLATES: Readonly<Record<EventType, EventTemplate>> = {
  wedding: weddingTemplate,
  birthday: birthdayTemplate,
  anniversary: anniversaryTemplate,
  community: communityTemplate,
};

/**
 * Retrieves a validated event template by its event type identifier.
 * WHY: Enables deterministic plan instantiation when a host begins an event planning workflow.
 *
 * @param type - The target event type ('wedding' | 'birthday' | 'anniversary' | 'community').
 * @returns The associated EventTemplate configuration.
 */
export function getTemplate(type: EventType): EventTemplate {
  return TEMPLATES[type];
}
