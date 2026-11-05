import { NotEnabledProvider } from './not-enabled';

/**
 * GooglePlayBillingProvider adapter (id: 'google_play_billing') — STUB. Not enabled.
 *
 * TODO (only after a signed provider contract, credentials and owner approval):
 * - Required for digital subscriptions sold inside the native Android app (Google Play payments policy).
 * - Verify purchase tokens with the Google Play Developer API; consume Real-time Developer Notifications (Pub/Sub).
 * - Map notifications (PURCHASED, RENEWED, IN_GRACE_PERIOD/ON_HOLD, CANCELED, REVOKED) to PaymentEvent types.
 * - createCheckout is not applicable (purchase happens in Play Billing Library on device).
 * - Construct only after assertLiveAllowed(process.env) passes.
 * - Never store card or wallet credentials; hosted checkout / provider-hosted flow only.
 */
export class GooglePlayBillingProvider extends NotEnabledProvider {
  readonly id = 'google_play_billing';
}
