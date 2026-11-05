import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getPlan, isPlanId } from './plans';
import {
  PAYMENT_EVENT_TYPES,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
} from './types';

export const SANDBOX_SIGNATURE_HEADER = 'x-fg-signature';
export const DEFAULT_SANDBOX_BASE_URL = 'http://localhost:3100/sandbox/checkout';
const SESSION_TTL_MS = 30 * 60 * 1000;

export class PaymentEventParseError extends Error {
  readonly code = 'INVALID_EVENT_PAYLOAD' as const;
  constructor(message: string) {
    super(message);
    this.name = 'PaymentEventParseError';
  }
}

/** HMAC-SHA256 hex over the exact raw body. For tests and the local webhook simulator. */
export function signSandboxPayload(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** Constant-time verification of the x-fg-signature header. Never throws. */
export function verifySandboxWebhook(rawBody: string, signature: string, secret: string): boolean {
  if (typeof rawBody !== 'string' || typeof signature !== 'string' || !secret) return false;
  const sig = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = Buffer.from(signSandboxPayload(rawBody, secret), 'hex');
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export interface SandboxCheckoutOptions {
  baseUrl?: string;
  now?: Date;
  /** Injectable for deterministic tests. */
  idFactory?: () => string;
}

/**
 * Creates a sandbox hosted-checkout session. No network, no card data: the URL points at a
 * local sandbox page that simulates the provider's hosted checkout.
 */
export function createSandboxCheckout(req: CheckoutRequest, opts: SandboxCheckoutOptions = {}): CheckoutSession {
  if (!isPlanId(req.planId)) throw new PaymentEventParseError(`Unknown plan: ${String(req.planId)}`);
  if (req.planId === 'free') throw new PaymentEventParseError('The free plan needs no checkout');
  if (!req.payerUserId || !req.familyId) throw new PaymentEventParseError('payerUserId and familyId are required');
  getPlan(req.planId);
  const now = opts.now ?? new Date();
  const sessionId = `sbx_cs_${(opts.idFactory ?? randomUUID)()}`;
  const url = new URL(opts.baseUrl ?? DEFAULT_SANDBOX_BASE_URL);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('plan', req.planId);
  if (req.returnUrl) url.searchParams.set('return', req.returnUrl);
  return {
    sessionId,
    checkoutUrl: url.toString(),
    sandbox: true,
    planId: req.planId,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
}

function isEventType(v: unknown): v is PaymentEventType {
  return typeof v === 'string' && (PAYMENT_EVENT_TYPES as readonly string[]).includes(v);
}

function str(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Parses a sandbox webhook body. Expected shape:
 * { id, type, created, data: { payerUserId, familyId, subscriptionId?, planId?, sessionId?, periodEnd?, amountThb? } }
 * Call verifySandboxWebhook first; parsing does not authenticate.
 */
export function parseSandboxEvent(rawBody: string): PaymentEvent {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new PaymentEventParseError('Body is not valid JSON');
  }
  if (!body || typeof body !== 'object') throw new PaymentEventParseError('Body must be an object');
  const b = body as Record<string, unknown>;
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;
  const eventId = str(b, 'id');
  if (!eventId) throw new PaymentEventParseError('Missing event id');
  if (!isEventType(b.type)) throw new PaymentEventParseError(`Unsupported event type: ${String(b.type)}`);
  const payerUserId = str(data, 'payerUserId');
  const familyId = str(data, 'familyId');
  if (!payerUserId || !familyId) throw new PaymentEventParseError('Missing payerUserId or familyId');
  const planId = data.planId;
  if (planId !== undefined && !isPlanId(planId)) throw new PaymentEventParseError(`Unknown plan: ${String(planId)}`);
  const amount = data.amountThb;
  if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
    throw new PaymentEventParseError('amountThb must be a non-negative number');
  }
  const ev: PaymentEvent = {
    eventId,
    type: b.type,
    occurredAt: str(b, 'created') ?? new Date().toISOString(),
    provider: 'sandbox',
    payerUserId,
    familyId,
  };
  const subscriptionId = str(data, 'subscriptionId');
  const sessionId = str(data, 'sessionId');
  const periodEnd = str(data, 'periodEnd');
  if (subscriptionId) ev.subscriptionId = subscriptionId;
  if (planId !== undefined) ev.planId = planId;
  if (sessionId) ev.sessionId = sessionId;
  if (periodEnd) ev.periodEnd = periodEnd;
  if (typeof amount === 'number') ev.amountThb = amount;
  return ev;
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name) return Array.isArray(v) ? v[0] : v;
  }
  return undefined;
}

export class SandboxProvider implements PaymentProvider {
  readonly id = 'sandbox';
  constructor(
    private readonly secret: string,
    private readonly opts: SandboxCheckoutOptions = {},
  ) {
    if (!secret) throw new Error('SandboxProvider requires a webhook secret');
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    return createSandboxCheckout(req, this.opts);
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
    const sig = headerValue(headers, SANDBOX_SIGNATURE_HEADER);
    return sig ? verifySandboxWebhook(rawBody, sig, this.secret) : false;
  }

  parseEvent(rawBody: string): PaymentEvent {
    return parseSandboxEvent(rawBody);
  }

  /** Sandbox refund: records nothing, moves no money. The state change arrives as a charge.refunded event. */
  async refund(req: RefundRequest): Promise<RefundResult> {
    if (!req.subscriptionId) throw new Error('subscriptionId is required');
    return {
      refundId: `sbx_re_${(this.opts.idFactory ?? randomUUID)()}`,
      subscriptionId: req.subscriptionId,
      status: 'succeeded',
      sandbox: true,
    };
  }
}
