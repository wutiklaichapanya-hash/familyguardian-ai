import { NotEnabledProvider } from './not-enabled';

/**
 * CardProvider adapter (id: 'card') — STUB. Not enabled.
 *
 * TODO (only after a signed provider contract, credentials and owner approval):
 * - Use the gateway's hosted payment page (redirect) only so PAN/CVV never reach our servers (aim: smallest PCI DSS scope, to verify with the gateway).
 * - Use gateway-side tokenised recurring billing; we store only the gateway customer/subscription ids.
 * - Handle 3-D Secure in the hosted flow.
 * - Construct only after assertLiveAllowed(process.env) passes.
 * - Never store card or wallet credentials; hosted checkout / provider-hosted flow only.
 */
export class CardProvider extends NotEnabledProvider {
  readonly id = 'card';
}
