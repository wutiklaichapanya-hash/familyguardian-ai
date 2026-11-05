import type { PaymentProvider, CheckoutRequest, CheckoutSession, PaymentEvent, RefundRequest, RefundResult } from '../types';

export const NOT_ENABLED_MESSAGE = 'NOT_ENABLED: requires contract, credentials and owner approval';

export class ProviderNotEnabledError extends Error {
  readonly code = 'NOT_ENABLED' as const;
  constructor(readonly providerId: string) {
    super(NOT_ENABLED_MESSAGE);
    this.name = 'ProviderNotEnabledError';
  }
}

/**
 * Base for live adapters that are intentionally not implemented. Every method throws.
 * Real implementations must: use the provider's HOSTED checkout only (no card data on our
 * servers), verify webhooks with the provider's documented scheme, map events to PaymentEvent,
 * and be constructed only after assertLiveAllowed(env) passes.
 */
export abstract class NotEnabledProvider implements PaymentProvider {
  abstract readonly id: string;
  createCheckout(_req: CheckoutRequest): Promise<CheckoutSession> {
    throw new ProviderNotEnabledError(this.id);
  }
  verifyWebhook(_rawBody: string, _headers: Record<string, string | string[] | undefined>): boolean {
    throw new ProviderNotEnabledError(this.id);
  }
  parseEvent(_rawBody: string): PaymentEvent {
    throw new ProviderNotEnabledError(this.id);
  }
  refund(_req: RefundRequest): Promise<RefundResult> {
    throw new ProviderNotEnabledError(this.id);
  }
}
