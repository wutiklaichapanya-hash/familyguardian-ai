import { describe, expect, it } from 'vitest';
import {
  applyPaymentEvent,
  effectiveEntitlements,
  PaymentStateError,
  type PaymentEvent,
  type PaymentEventType,
  type SubscriptionState,
  type SubscriptionStatus,
} from '../src';

const OWNER = { payerUserId: 'u_nok', familyId: 'fam_1' };
let n = 0;
function ev(type: PaymentEventType, extra: Partial<PaymentEvent> = {}): PaymentEvent {
  n += 1;
  return { eventId: `evt_${n}`, type, occurredAt: '2026-11-01T00:00:00.000Z', provider: 'sandbox', ...OWNER, ...extra };
}
function subIn(status: SubscriptionStatus): SubscriptionState {
  return {
    id: 'sub_1', planId: 'family_care', status, currentPeriodEnd: '2026-12-01T00:00:00.000Z', provider: 'sandbox',
    ...OWNER, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };
}
const none: string[] = [];

describe('applyPaymentEvent: valid lifecycle transitions', () => {
  it('none --checkout.completed--> trialing, owned by payer + family', () => {
    const r = applyPaymentEvent(null, ev('checkout.completed', { planId: 'guardian_plus', subscriptionId: 'sub_9' }), none);
    expect(r).toMatchObject({ changed: true, duplicate: false, from: 'none', to: 'trialing' });
    expect(r.subscription).toMatchObject({ id: 'sub_9', status: 'trialing', planId: 'guardian_plus', payerUserId: 'u_nok', familyId: 'fam_1', provider: 'sandbox' });
    expect(r.subscription!.currentPeriodEnd).toBe('2026-11-15T00:00:00.000Z'); // 14-day trial default
  });

  const table: Array<[SubscriptionStatus, PaymentEventType, SubscriptionStatus]> = [
    ['trialing', 'invoice.paid', 'active'],
    ['active', 'invoice.paid', 'active'],
    ['past_due', 'invoice.paid', 'active'],
    ['trialing', 'invoice.payment_failed', 'past_due'],
    ['active', 'invoice.payment_failed', 'past_due'],
    ['past_due', 'invoice.payment_failed', 'past_due'],
    ['trialing', 'subscription.canceled', 'canceled'],
    ['active', 'subscription.canceled', 'canceled'],
    ['past_due', 'subscription.canceled', 'canceled'],
    ['active', 'charge.refunded', 'refunded'],
    ['past_due', 'charge.refunded', 'refunded'],
    ['canceled', 'charge.refunded', 'refunded'],
  ];
  it.each(table)('%s --%s--> %s', (from, type, to) => {
    const r = applyPaymentEvent(subIn(from), ev(type), none);
    expect(r.changed).toBe(true);
    expect(r.from).toBe(from);
    expect(r.subscription!.status).toBe(to);
  });

  it('full happy path trialing → active → past_due → active → canceled → refunded', () => {
    const processed = new Set<string>();
    let sub: SubscriptionState | null = null;
    const steps: Array<[PaymentEventType, SubscriptionStatus]> = [
      ['checkout.completed', 'trialing'], ['invoice.paid', 'active'], ['invoice.payment_failed', 'past_due'],
      ['invoice.paid', 'active'], ['subscription.canceled', 'canceled'], ['charge.refunded', 'refunded'],
    ];
    for (const [type, expected] of steps) {
      const e = ev(type, type === 'checkout.completed' ? { planId: 'family_care' } : {});
      const r = applyPaymentEvent(sub, e, processed);
      processed.add(e.eventId);
      sub = r.subscription;
      expect(sub!.status).toBe(expected);
    }
  });

  it('invoice.paid extends the period from the later of current end and now', () => {
    const r = applyPaymentEvent(subIn('active'), ev('invoice.paid'), none);
    expect(r.subscription!.currentPeriodEnd).toBe('2026-12-31T00:00:00.000Z');
    const r2 = applyPaymentEvent(subIn('active'), ev('invoice.paid', { periodEnd: '2027-01-15T00:00:00.000Z' }), none);
    expect(r2.subscription!.currentPeriodEnd).toBe('2027-01-15T00:00:00.000Z');
  });

  it('does not mutate inputs', () => {
    const s = subIn('active');
    const snapshot = JSON.stringify(s);
    const processed = new Set<string>();
    applyPaymentEvent(s, ev('invoice.payment_failed'), processed);
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(processed.size).toBe(0);
  });
});

describe('applyPaymentEvent: invalid transitions are rejected with a typed error', () => {
  const invalid: Array<[SubscriptionStatus | null, PaymentEventType]> = [
    [null, 'invoice.paid'],
    [null, 'invoice.payment_failed'],
    [null, 'subscription.canceled'],
    [null, 'charge.refunded'],
    ['trialing', 'checkout.completed'],
    ['trialing', 'charge.refunded'],
    ['active', 'checkout.completed'],
    ['canceled', 'invoice.paid'],
    ['canceled', 'invoice.payment_failed'],
    ['canceled', 'subscription.canceled'],
    ['refunded', 'invoice.paid'],
    ['refunded', 'charge.refunded'],
    ['refunded', 'subscription.canceled'],
    ['refunded', 'checkout.completed'],
  ];
  it.each(invalid)('%s + %s throws PaymentStateError', (from, type) => {
    const sub = from ? subIn(from) : null;
    let err: unknown;
    try {
      applyPaymentEvent(sub, ev(type, { planId: 'family_care' }), none);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PaymentStateError);
    expect((err as PaymentStateError).code).toBe(from ? 'INVALID_TRANSITION' : 'SUBSCRIPTION_REQUIRED');
  });

  it('checkout.completed without a paid plan → PLAN_REQUIRED', () => {
    expect(() => applyPaymentEvent(null, ev('checkout.completed'), none)).toThrow(expect.objectContaining({ code: 'PLAN_REQUIRED' }));
    expect(() => applyPaymentEvent(null, ev('checkout.completed', { planId: 'free' }), none)).toThrow(expect.objectContaining({ code: 'PLAN_REQUIRED' }));
  });

  it('rejects events from a different payer or family (OWNER_MISMATCH)', () => {
    expect(() => applyPaymentEvent(subIn('active'), ev('invoice.paid', { payerUserId: 'u_anan' }), none)).toThrow(expect.objectContaining({ code: 'OWNER_MISMATCH' }));
    expect(() => applyPaymentEvent(subIn('active'), ev('invoice.paid', { familyId: 'fam_2' }), none)).toThrow(expect.objectContaining({ code: 'OWNER_MISMATCH' }));
  });

  it('rejects events for another subscription (SUBSCRIPTION_MISMATCH)', () => {
    expect(() => applyPaymentEvent(subIn('active'), ev('invoice.paid', { subscriptionId: 'sub_other' }), none)).toThrow(expect.objectContaining({ code: 'SUBSCRIPTION_MISMATCH' }));
  });
});

describe('applyPaymentEvent: idempotency on eventId', () => {
  it('same event twice → exactly one state change', () => {
    const processed = new Set<string>();
    const e = ev('invoice.payment_failed');
    const first = applyPaymentEvent(subIn('active'), e, processed);
    processed.add(e.eventId);
    const second = applyPaymentEvent(first.subscription, e, processed);
    expect(first.changed).toBe(true);
    expect(second).toMatchObject({ changed: false, duplicate: true, from: 'past_due', to: 'past_due' });
    expect(second.subscription).toBe(first.subscription);
  });

  it('a replayed event that would now be invalid is a no-op, not an error', () => {
    const e = ev('subscription.canceled');
    const first = applyPaymentEvent(subIn('active'), e, []);
    expect(() => applyPaymentEvent(first.subscription, e, [e.eventId])).not.toThrow();
  });

  it('replayed checkout.completed does not create a second subscription', () => {
    const e = ev('checkout.completed', { planId: 'family_care' });
    const first = applyPaymentEvent(null, e, []);
    const replay = applyPaymentEvent(null, e, [e.eventId]);
    expect(first.subscription).not.toBeNull();
    expect(replay).toMatchObject({ subscription: null, changed: false, duplicate: true });
  });
});

describe('refund', () => {
  it('refund ends entitlements immediately and records refundedAt', () => {
    const r = applyPaymentEvent(subIn('active'), ev('charge.refunded', { occurredAt: '2026-11-03T00:00:00.000Z' }), none);
    expect(r.subscription).toMatchObject({ status: 'refunded', refundedAt: '2026-11-03T00:00:00.000Z', currentPeriodEnd: '2026-11-03T00:00:00.000Z' });
    expect(effectiveEntitlements(r.subscription, new Date('2026-11-04T00:00:00.000Z')).guardianPause).toBe(true); // safety: never paywalled
  });
});

describe('effectiveEntitlements', () => {
  const now = new Date('2026-11-05T00:00:00.000Z');
  it('paid plan for trialing / active / past_due (grace)', () => {
    for (const s of ['trialing', 'active', 'past_due'] as const) {
      expect(effectiveEntitlements(subIn(s), now).maxFamilyMembers).toBe(5);
    }
  });
  it('canceled keeps the plan until period end, then free', () => {
    expect(effectiveEntitlements(subIn('canceled'), now).maxFamilyMembers).toBe(5);
    expect(effectiveEntitlements(subIn('canceled'), new Date('2026-12-02T00:00:00.000Z')).maxFamilyMembers).toBe(2);
    expect(effectiveEntitlements(subIn('canceled'), new Date('2026-12-02T00:00:00.000Z')).guardianPause).toBe(true);
  });
  it('no subscription → free, and help is never gated', () => {
    const e = effectiveEntitlements(null, now);
    expect(e.maxFamilyMembers).toBe(2);
    expect(e.helpRequests).toBe(true);
    expect(e.officialHelpNumbers).toBe(true);
  });
});
