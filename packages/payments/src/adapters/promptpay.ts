import { NotEnabledProvider } from './not-enabled';

/**
 * PromptPayProvider adapter (id: 'promptpay') — STUB. Not enabled.
 *
 * TODO (only after a signed provider contract, credentials and owner approval):
 * - Generate PromptPay QR via the chosen gateway (Omise/Opn, 2C2P, GB Prime Pay, ...); QR is a one-off push payment,
 *   so recurring billing needs reminders + a fresh QR per period (no auto-debit).
 * - Map gateway charge-complete webhooks to invoice.paid / checkout.completed.
 * - Construct only after assertLiveAllowed(process.env) passes.
 * - Never store card or wallet credentials; hosted checkout / provider-hosted flow only.
 */
export class PromptPayProvider extends NotEnabledProvider {
  readonly id = 'promptpay';
}
