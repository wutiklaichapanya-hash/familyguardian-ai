import { NotEnabledProvider } from './not-enabled';

/**
 * TrueMoneyProvider adapter (id: 'truemoney') — STUB. Not enabled.
 *
 * TODO (only after a signed provider contract, credentials and owner approval):
 * - Integrate TrueMoney Wallet via an aggregator gateway's redirect flow.
 * - Confirm whether recurring/auto-debit is supported for subscriptions (to verify).
 * - Construct only after assertLiveAllowed(process.env) passes.
 * - Never store card or wallet credentials; hosted checkout / provider-hosted flow only.
 */
export class TrueMoneyProvider extends NotEnabledProvider {
  readonly id = 'truemoney';
}
