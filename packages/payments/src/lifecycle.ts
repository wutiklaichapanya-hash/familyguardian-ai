import { entitlementsFor, isPlanId, type Entitlements } from './plans';
import type { PaymentEvent, PaymentEventType, SubscriptionState, SubscriptionStatus } from './types';

/*
 * Pure subscription state machine:
 *
 *   (none) --checkout.completed--> trialing
 *   trialing --invoice.paid--> active
 *   active   --invoice.paid--> active        (renewal, period extended)
 *   past_due --invoice.paid--> active        (recovered)
 *   trialing|active|past_due --invoice.payment_failed--> past_due
 *   trialing|active|past_due --subscription.canceled--> canceled
 *   active|past_due|canceled --charge.refunded--> refunded
 *
 * canceled and refunded are terminal except canceled -> refunded. A new subscription after
 * cancel/refund starts from (none) with a fresh checkout.
 * Idempotent on eventId: replaying a processed event returns the input unchanged.
 * The function never mutates its inputs; the caller persists the new state AND the eventId
 * in the same transaction.
 */

export type PaymentStateErrorCode =
  | 'INVALID_TRANSITION'
  | 'SUBSCRIPTION_REQUIRED'
  | 'SUBSCRIPTION_MISMATCH'
  | 'OWNER_MISMATCH'
  | 'PLAN_REQUIRED';

export class PaymentStateError extends Error {
  constructor(
    readonly code: PaymentStateErrorCode,
    message: string,
    readonly from: SubscriptionStatus | 'none',
    readonly eventType: PaymentEventType,
  ) {
    super(message);
    this.name = 'PaymentStateError';
  }
}

export interface ApplyResult {
  subscription: SubscriptionState | null;
  /** false when the event was a duplicate (already processed). */
  changed: boolean;
  duplicate: boolean;
  from: SubscriptionStatus | 'none';
  to: SubscriptionStatus | 'none';
}

export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type From = SubscriptionStatus | 'none';
const TRANSITIONS: Record<PaymentEventType, Partial<Record<From, SubscriptionStatus>>> = {
  'checkout.completed': { none: 'trialing' },
  'invoice.paid': { trialing: 'active', active: 'active', past_due: 'active' },
  'invoice.payment_failed': { trialing: 'past_due', active: 'past_due', past_due: 'past_due' },
  'subscription.canceled': { trialing: 'canceled', active: 'canceled', past_due: 'canceled' },
  'charge.refunded': { active: 'refunded', past_due: 'refunded', canceled: 'refunded' },
};

export function canTransition(from: From, eventType: PaymentEventType): SubscriptionStatus | null {
  return TRANSITIONS[eventType][from] ?? null;
}

function addDays(iso: string, days: number): string {
  const t = Date.parse(iso);
  return new Date((Number.isNaN(t) ? Date.now() : t) + days * DAY_MS).toISOString();
}

function laterOf(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function hasProcessed(ids: ReadonlySet<string> | readonly string[], id: string): boolean {
  return Array.isArray(ids) ? ids.includes(id) : (ids as ReadonlySet<string>).has(id);
}

export function applyPaymentEvent(
  sub: SubscriptionState | null,
  event: PaymentEvent,
  processedEventIds: ReadonlySet<string> | readonly string[],
): ApplyResult {
  const from: From = sub ? sub.status : 'none';
  if (hasProcessed(processedEventIds, event.eventId)) {
    return { subscription: sub, changed: false, duplicate: true, from, to: from };
  }

  const to = canTransition(from, event.type);
  if (!to) {
    throw new PaymentStateError(
      sub ? 'INVALID_TRANSITION' : 'SUBSCRIPTION_REQUIRED',
      `Event ${event.type} is not allowed from state ${from}`,
      from,
      event.type,
    );
  }

  const at = event.occurredAt;

  if (!sub) {
    // checkout.completed: create the subscription for the family entitlement owner.
    if (!event.planId || !isPlanId(event.planId) || event.planId === 'free') {
      throw new PaymentStateError('PLAN_REQUIRED', 'checkout.completed needs a paid planId', from, event.type);
    }
    const created: SubscriptionState = {
      id: event.subscriptionId ?? `sbx_sub_${event.eventId}`,
      planId: event.planId,
      status: to,
      currentPeriodEnd: event.periodEnd ?? addDays(at, DEFAULT_TRIAL_DAYS),
      provider: 'sandbox',
      payerUserId: event.payerUserId,
      familyId: event.familyId,
      createdAt: at,
      updatedAt: at,
      canceledAt: null,
      refundedAt: null,
      lastEventId: event.eventId,
    };
    return { subscription: created, changed: true, duplicate: false, from, to };
  }

  if (event.subscriptionId && event.subscriptionId !== sub.id) {
    throw new PaymentStateError('SUBSCRIPTION_MISMATCH', 'Event is for a different subscription', from, event.type);
  }
  if (event.payerUserId !== sub.payerUserId || event.familyId !== sub.familyId) {
    throw new PaymentStateError('OWNER_MISMATCH', 'Event payer/family does not match the entitlement owner', from, event.type);
  }

  const next: SubscriptionState = { ...sub, status: to, updatedAt: at, lastEventId: event.eventId };
  switch (event.type) {
    case 'invoice.paid':
      next.currentPeriodEnd = event.periodEnd ?? addDays(laterOf(sub.currentPeriodEnd, at), DEFAULT_PERIOD_DAYS);
      if (event.planId && isPlanId(event.planId) && event.planId !== 'free') next.planId = event.planId;
      break;
    case 'subscription.canceled':
      next.canceledAt = at;
      break;
    case 'charge.refunded':
      next.refundedAt = at;
      next.currentPeriodEnd = at;
      break;
    default:
      break;
  }
  return { subscription: next, changed: true, duplicate: false, from, to };
}

/**
 * Entitlements a family actually gets from a subscription.
 * trialing / active / past_due (grace period) → plan entitlements.
 * canceled → plan entitlements until currentPeriodEnd, then free.
 * refunded / none → free.
 */
export function effectiveEntitlements(sub: SubscriptionState | null, now: Date = new Date()): Entitlements {
  if (!sub) return entitlementsFor('free');
  switch (sub.status) {
    case 'trialing':
    case 'active':
    case 'past_due':
      return entitlementsFor(sub.planId);
    case 'canceled':
      return Date.parse(sub.currentPeriodEnd) > now.getTime() ? entitlementsFor(sub.planId) : entitlementsFor('free');
    case 'refunded':
    default:
      return entitlementsFor('free');
  }
}
