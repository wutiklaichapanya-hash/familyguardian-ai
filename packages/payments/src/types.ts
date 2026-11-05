import type { ISODate, SubscriptionDTO } from '@fg/shared';
import type { PlanId } from './plans';

export const PAYMENT_EVENT_TYPES = [
  'checkout.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'subscription.canceled',
  'charge.refunded',
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

export type SubscriptionStatus = SubscriptionDTO['status'];

/**
 * The family entitlement owner: the person who pays (payerUserId) and the family whose
 * members receive the plan's entitlements (familyId). The payer is not necessarily the senior.
 */
export interface EntitlementOwner {
  payerUserId: string;
  familyId: string;
}

/** Internal subscription state (superset of SubscriptionDTO). */
export interface SubscriptionState extends SubscriptionDTO, EntitlementOwner {
  createdAt: ISODate;
  updatedAt: ISODate;
  canceledAt?: ISODate | null;
  refundedAt?: ISODate | null;
  /** The most recent provider event applied (debug/audit only; idempotency uses processedEventIds). */
  lastEventId?: string | null;
}

/** Normalised provider event. Never contains card data (hosted checkout only). */
export interface PaymentEvent {
  eventId: string;
  type: PaymentEventType;
  occurredAt: ISODate;
  provider: 'sandbox';
  payerUserId: string;
  familyId: string;
  subscriptionId?: string;
  planId?: PlanId;
  sessionId?: string;
  /** End of the paid/trial period this event establishes, if any. */
  periodEnd?: ISODate;
  amountThb?: number;
}

export interface CheckoutRequest extends EntitlementOwner {
  planId: PlanId;
  /** Where the hosted page sends the user afterwards. */
  returnUrl?: string;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  sandbox: true;
  planId: PlanId;
  expiresAt: ISODate;
}

export interface RefundRequest {
  subscriptionId: string;
  amountThb?: number;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  subscriptionId: string;
  status: 'pending' | 'succeeded';
  sandbox: boolean;
}

/**
 * Provider adapter. Entitlements never depend on which provider is used; providers only
 * create hosted checkouts, verify/parse webhooks, and issue refunds.
 */
export interface PaymentProvider {
  readonly id: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean;
  parseEvent(rawBody: string): PaymentEvent;
  refund(req: RefundRequest): Promise<RefundResult>;
}
