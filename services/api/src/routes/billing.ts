// P1 billing — SANDBOX ONLY (no real charges). Uses @fg/payments for plans, checkout, HMAC verification and the state machine.
// Owner decision: Guardian Pause is free on every plan, so no safety feature is gated here.
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  PLANS, PaymentStateError, applyPaymentEvent, createSandboxCheckout, parseSandboxEvent, verifySandboxWebhook,
  SANDBOX_SIGNATURE_HEADER, type PaymentEvent, type SubscriptionState,
} from '@fg/payments';
import type { SubscriptionDTO } from '@fg/shared';
import { type Ctx, requireRole } from '../app';
import { families, familyMemberships, paymentEvents, subscriptions } from '../db/schema';
import type { Tx } from '../db/client';
import { recordAudit } from '../audit';
import { HttpError, badRequest, notFound } from '../errors';
import { checkoutReq, doc } from '../validation';

type SubRow = typeof subscriptions.$inferSelect;
const toState = (r: SubRow): SubscriptionState => ({
  id: r.id, planId: r.planId as SubscriptionState['planId'], status: r.status as SubscriptionState['status'],
  currentPeriodEnd: r.currentPeriodEnd.toISOString(), provider: 'sandbox', payerUserId: r.payerUserId, familyId: r.familyId,
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  canceledAt: r.canceledAt?.toISOString() ?? null, refundedAt: r.refundedAt?.toISOString() ?? null, lastEventId: r.lastEventId,
});
const toDTO = (r: SubRow): SubscriptionDTO => ({ id: r.id, planId: r.planId as SubscriptionDTO['planId'], status: r.status as SubscriptionDTO['status'], currentPeriodEnd: r.currentPeriodEnd.toISOString(), provider: 'sandbox' });
const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

export default async function billingRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config } = ctx;

  /** The family whose plan the caller manages: their own (senior) or their first confirmed circle. */
  const familyFor = async (userId: string) => {
    const [own] = await db.select({ id: families.id }).from(families).where(eq(families.seniorId, userId));
    if (own) return own.id;
    const [m] = await db.select({ id: familyMemberships.familyId }).from(familyMemberships)
      .where(and(eq(familyMemberships.userId, userId), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active'))).limit(1);
    return m?.id ?? null;
  };
  const currentSub = async (familyId: string, tx: Tx = db) => {
    const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.familyId, familyId)).orderBy(desc(subscriptions.createdAt)).limit(1);
    return s ?? null;
  };

  /** Apply one event idempotently (unique providerEventId) and persist state + event in one transaction. */
  const applyEvent = async (event: PaymentEvent) => db.transaction(async (tx) => {
    const [dup] = await tx.select({ id: paymentEvents.id }).from(paymentEvents).where(eq(paymentEvents.providerEventId, event.eventId));
    if (dup) return { duplicate: true, sub: null as SubRow | null };
    // The entitlement owner must be a real family and the payer its senior or a confirmed member.
    const [fam] = await tx.select({ seniorId: families.seniorId }).from(families).where(eq(families.id, event.familyId));
    const payerOk = fam && (fam.seniorId === event.payerUserId || (await tx.select({ id: familyMemberships.id }).from(familyMemberships)
      .where(and(eq(familyMemberships.familyId, event.familyId), eq(familyMemberships.userId, event.payerUserId), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')))).length > 0);
    if (!payerOk) throw badRequest('INVALID_OWNER', 'Unknown family or payer');
    let existing: SubRow | null = null;
    if (event.subscriptionId) [existing = null] = await tx.select().from(subscriptions).where(eq(subscriptions.id, event.subscriptionId));
    else if (event.type !== 'checkout.completed') existing = await currentSub(event.familyId, tx);
    const res = applyPaymentEvent(existing ? toState(existing) : null, event, []);
    const s = res.subscription!;
    const values = {
      id: s.id, familyId: s.familyId, payerUserId: s.payerUserId, planId: s.planId, status: s.status, currentPeriodEnd: new Date(s.currentPeriodEnd),
      provider: 'sandbox', canceledAt: s.canceledAt ? new Date(s.canceledAt) : null, refundedAt: s.refundedAt ? new Date(s.refundedAt) : null,
      lastEventId: s.lastEventId ?? null, updatedAt: new Date(s.updatedAt),
    };
    const [row] = await tx.insert(subscriptions).values({ ...values, createdAt: new Date(s.createdAt) })
      .onConflictDoUpdate({ target: subscriptions.id, set: values }).returning();
    await tx.insert(paymentEvents).values({ providerEventId: event.eventId, subscriptionId: s.id, type: event.type, payload: { type: event.type, planId: event.planId ?? null, from: res.from, to: res.to } });
    await recordAudit(tx, { actorId: event.payerUserId, action: `billing.${event.type}`, targetType: 'subscription', targetId: s.id, meta: { from: res.from, to: res.to } });
    return { duplicate: false, sub: row! };
  });

  app.get('/billing/plans', { schema: { tags: ['billing'], summary: 'Plans (pricing is a hypothesis; sandbox only)' } }, async () => PLANS);

  app.get('/me/subscription', { schema: { tags: ['billing'], summary: 'Current family subscription or null' } }, async (req) => {
    const u = requireRole(req, 'senior', 'family', 'caregiver');
    const fam = await familyFor(u.id);
    const s = fam ? await currentSub(fam) : null;
    return s ? toDTO(s) : null;
  });

  app.post('/me/subscription/checkout', { schema: { tags: ['billing'], summary: 'Start a SANDBOX hosted checkout', body: doc(checkoutReq) } }, async (req) => {
    const u = requireRole(req, 'senior', 'family', 'caregiver');
    const { planId } = checkoutReq.parse(req.body);
    const fam = await familyFor(u.id);
    if (!fam) throw badRequest('NO_FAMILY', 'Join or create a family first');
    if (planId === 'free') throw badRequest('FREE_PLAN', 'The free plan needs no checkout');
    const s = createSandboxCheckout({ planId, payerUserId: u.id, familyId: fam, returnUrl: `${config.webOrigin}/settings/billing` }, { baseUrl: `${config.webOrigin}/sandbox/checkout` });
    await recordAudit(db, { actorId: u.id, action: 'billing.checkout_started', targetType: 'checkout', targetId: s.sessionId, meta: { planId } });
    return { checkoutUrl: s.checkoutUrl, sandbox: true as const };
  });

  app.post('/me/subscription/cancel', { schema: { tags: ['billing'], summary: 'Cancel the family subscription (sandbox)' } }, async (req) => {
    const u = requireRole(req, 'senior', 'family', 'caregiver');
    const fam = await familyFor(u.id);
    const cur = fam ? await currentSub(fam) : null;
    if (!cur) throw notFound('No subscription');
    try {
      const r = await applyEvent({
        eventId: `local_cancel_${randomUUID()}`, type: 'subscription.canceled', occurredAt: new Date().toISOString(), provider: 'sandbox',
        payerUserId: cur.payerUserId, familyId: cur.familyId, subscriptionId: cur.id,
      });
      return toDTO(r.sub!);
    } catch (e) {
      if (e instanceof PaymentStateError) throw new HttpError(409, e.code, e.message);
      throw e;
    }
  });

  // Webhook: raw body needed for HMAC → encapsulated JSON-as-string parser. CSRF-exempt (server-to-server, HMAC-verified).
  await app.register(async (w) => {
    w.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body));
    w.post('/webhooks/payments/sandbox', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, schema: { tags: ['billing'], summary: 'Sandbox payment webhook (HMAC x-fg-signature; idempotent on eventId)' } }, async (req, reply) => {
      const raw = typeof req.body === 'string' ? req.body : '';
      const sig = String(req.headers[SANDBOX_SIGNATURE_HEADER] ?? '');
      if (config.paymentsMode !== 'sandbox' || !verifySandboxWebhook(raw, sig, config.sandboxWebhookSecret)) {
        throw new HttpError(401, 'INVALID_SIGNATURE', 'Signature check failed');
      }
      let event: PaymentEvent;
      try { event = parseSandboxEvent(raw); } catch (e) { throw badRequest('INVALID_EVENT', e instanceof Error ? e.message : 'Invalid event'); }
      if (Math.abs(Date.now() - Date.parse(event.occurredAt)) > WEBHOOK_TOLERANCE_MS) throw badRequest('STALE_EVENT', 'Event timestamp outside tolerance');
      try {
        const r = await applyEvent(event);
        return reply.status(200).send({ received: true, duplicate: r.duplicate });
      } catch (e) {
        if (e instanceof PaymentStateError) throw new HttpError(409, e.code, e.message);
        throw e;
      }
    });
  });
}
