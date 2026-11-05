import { NotEnabledProvider } from './not-enabled';

/**
 * ShopeePayProvider adapter (id: 'shopeepay') — STUB. Not enabled.
 *
 * TODO (only after a signed provider contract, credentials and owner approval):
 * - Integrate ShopeePay via an aggregator gateway's redirect/deeplink flow.
 * - Confirm whether recurring/auto-debit is supported for subscriptions (to verify).
 * - Construct only after assertLiveAllowed(process.env) passes.
 * - Never store card or wallet credentials; hosted checkout / provider-hosted flow only.
 */
export class ShopeePayProvider extends NotEnabledProvider {
  readonly id = 'shopeepay';
}
