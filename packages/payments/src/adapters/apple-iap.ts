import { NotEnabledProvider } from './not-enabled';

/**
 * AppleIapProvider adapter (id: 'apple_iap') — STUB. Not enabled.
 *
 * TODO (only after a signed provider contract, credentials and owner approval):
 * - Required for digital subscriptions sold inside the native iOS app (App Store Review Guidelines, in-app purchase).
 * - Verify transactions with App Store Server API / signed JWS; consume App Store Server Notifications v2.
 * - Map notifications (SUBSCRIBED, DID_RENEW, DID_FAIL_TO_RENEW, EXPIRED, REFUND) to PaymentEvent types.
 * - createCheckout is not applicable (purchase happens in StoreKit on device); refunds are issued by Apple.
 * - Construct only after assertLiveAllowed(process.env) passes.
 * - Never store card or wallet credentials; hosted checkout / provider-hosted flow only.
 */
export class AppleIapProvider extends NotEnabledProvider {
  readonly id = 'apple_iap';
}
