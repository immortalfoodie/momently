import type { EventMeta, GuestNeeds, Money } from '@/domain/types';
import type { EngineContext } from './context';
import { createPlan } from './planFactory';

/**
 * Calculates the absolute minimum cost to produce an event at all-essential quality with no caps.
 * WHY: Establishes the non-negotiable financial floor below which a viable event cannot exist.
 *
 * @param meta - Event metadata including guest attendance, city, and event type.
 * @param guestNeeds - Optional dietary and accessibility needs.
 * @param ctx - Injected engine context.
 * @returns Non-negative integer INR rupee amount for essential tier baseline.
 */
export function minimumFeasibleCost(
  meta: EventMeta,
  guestNeeds: GuestNeeds | undefined,
  ctx: EngineContext,
): Money {
  const { fit } = createPlan({
    meta,
    constraints: [],
    guestNeeds,
    quality: 'essential',
    ids: ctx.ids,
    clock: ctx.clock,
  });
  return fit.total;
}

/**
 * Finds the maximum guest attendance achievable under a budget cap via monotonic binary search.
 * WHY: Provides deterministic guidance when a host's headcount exceeds what the cap can support.
 *
 * @param meta - Event metadata with baseline settings.
 * @param cap - Target budget cap amount.
 * @param guestNeeds - Optional dietary and accessibility needs.
 * @param ctx - Injected engine context.
 * @returns Maximum viable guest count between 0 and meta.guestCount.
 */
export function maxGuestsWithinCap(
  meta: EventMeta,
  cap: Money,
  guestNeeds: GuestNeeds | undefined,
  ctx: EngineContext,
): number {
  let low = 1;
  let high = meta.guestCount;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const floor = minimumFeasibleCost({ ...meta, guestCount: mid }, guestNeeds, ctx);
    if (floor <= cap) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
