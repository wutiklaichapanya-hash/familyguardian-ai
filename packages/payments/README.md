# @fg/payments

Pure TypeScript billing core for FamilyGuardian AI (P1, **sandbox only**). No network, no
dependencies beyond `@fg/shared` and `node:crypto`.

It keeps **entitlements** (what a family gets) separate from **payment providers** (how money
moves). See `docs/architecture/03_ARCHITECTURE.md` §6.

## No card data, ever

FamilyGuardian AI never collects, transmits, logs or stores card numbers, CVV, wallet PINs or bank
credentials. **Only provider-hosted checkout** (redirect to the provider's page, or the
on-device App Store / Google Play purchase sheet) will be used, now and in the future. Our servers
store only provider ids (customer, subscription, event ids), plan, status and period dates.

## What is in here

| Module | Purpose |
|---|---|
| `src/plans.ts` | `PLANS` (free ฿0 / family_care ฿199 / guardian_plus ฿349, all `hypothesis: true`), `ENTITLEMENTS`, `entitlementsFor(planId)` |
| `src/types.ts` | `PaymentProvider` interface, `PaymentEvent`, `SubscriptionState` (adds `payerUserId` + `familyId`) |
| `src/sandbox.ts` | `SandboxProvider`, `createSandboxCheckout`, `verifySandboxWebhook`, `signSandboxPayload`, `parseSandboxEvent` |
| `src/lifecycle.ts` | `applyPaymentEvent` pure state machine, `PaymentStateError`, `effectiveEntitlements` |
| `src/live-guard.ts` | `assertLiveAllowed(env)` |
| `src/adapters/*` | Stubs for promptpay, card, truemoney, shopeepay, apple_iap, google_play_billing (all throw `NOT_ENABLED: requires contract, credentials and owner approval`) |

**Pricing is a hypothesis to validate** (discovery doc, A10), not a decision. The UI must show
it that way.

**Help is never paywalled.** Every plan has `helpRequests: true` and `officialHelpNumbers: true`.
**Guardian Pause is free on every plan** (owner decision, 2026-11-05: a safety feature must not be
paywalled). Paid plans add capacity (family members, scam checks per day) and coordination features
(family digest, care tasks, caregiver access).

## Backend usage

```ts
import { createSandboxCheckout, verifySandboxWebhook, parseSandboxEvent, applyPaymentEvent, effectiveEntitlements } from '@fg/payments';

// POST /me/subscription/checkout
const s = createSandboxCheckout({ planId, payerUserId: user.id, familyId });
// -> { checkoutUrl, sessionId, sandbox: true, planId, expiresAt }

// POST /webhooks/payments/sandbox  (use the RAW body string, not re-serialised JSON)
if (!verifySandboxWebhook(rawBody, req.headers['x-fg-signature'] ?? '', process.env.SANDBOX_WEBHOOK_SECRET!)) return 401;
const event = parseSandboxEvent(rawBody);
const { subscription, changed } = applyPaymentEvent(currentSubOrNull, event, processedEventIds);
// In ONE transaction: persist `subscription` and insert event.eventId into processed events
// (unique constraint on provider_event_id). Catch PaymentStateError -> 409, log, do not retry.
```

Webhook body shape (sandbox):

```json
{ "id": "evt_...", "type": "invoice.paid", "created": "2026-11-01T00:00:00Z",
  "data": { "payerUserId": "...", "familyId": "...", "subscriptionId": "...", "planId": "family_care", "periodEnd": "...", "amountThb": 199 } }
```

Signature: `x-fg-signature: hex(HMAC-SHA256(secret, rawBody))`, compared with `crypto.timingSafeEqual`.
Use `signSandboxPayload(rawBody, secret)` in tests and the simulator.

## Lifecycle

```
(none) --checkout.completed--> trialing
trialing | past_due | active --invoice.paid--> active
trialing | active | past_due --invoice.payment_failed--> past_due
trialing | active | past_due --subscription.canceled--> canceled
active | past_due | canceled --charge.refunded--> refunded
```

- Idempotent on `eventId`: a processed event returns `{ changed: false, duplicate: true }` and the input unchanged, even if it would now be invalid.
- Invalid transitions throw `PaymentStateError` with `code`: `INVALID_TRANSITION`, `SUBSCRIPTION_REQUIRED`, `SUBSCRIPTION_MISMATCH`, `OWNER_MISMATCH`, `PLAN_REQUIRED`.
- Entitlement owner = payer `userId` + `familyId`. Events whose payer/family differ are rejected.
- `effectiveEntitlements`: trialing / active / past_due (grace) give plan entitlements; canceled keeps them until `currentPeriodEnd`; refunded or no subscription means free.
- Defaults (hypotheses): 14-day trial, 30-day period when the event carries no `periodEnd`.

## Live payments guard

`assertLiveAllowed(env)` throws `LivePaymentsDisabledError` unless **all** are true:

1. `PAYMENTS_MODE === 'live'`
2. `PAYMENTS_PROVIDER_KEY` and `PAYMENTS_WEBHOOK_SECRET` are non-empty
3. `RELEASE_PAYMENTS_SIGNED === 'true'` (owner-signed payments release)

Call it before constructing any non-sandbox adapter. Note: architecture §6 calls the switch
`PAYMENTS_LIVE=true`; this package uses `PAYMENTS_MODE=live` (matches the root `.env`). The docs should be aligned.

## Provider selection note (Thailand) — options to evaluate, not a decision

Nothing below is a recommendation or a verified fact about current terms. Any fee, rate or
capability must be confirmed directly with the provider and is marked **to verify**.

| Option | Why evaluate | Questions to answer |
|---|---|---|
| **Omise / Opn Payments** | Thai-origin gateway; commonly used for cards and PromptPay QR in Thailand | Hosted checkout / payment links for subscriptions? Recurring card billing? TrueMoney / ShopeePay / mobile banking support? Fees (to verify), settlement time (to verify), onboarding for an early-stage company |
| **2C2P** | Large Southeast Asian gateway with broad local payment methods | Hosted payment page, recurring payment support, wallet coverage, minimum volume or setup fees (to verify) |
| **GB Prime Pay** | Thai gateway, often cited for QR and local methods | Recurring billing support, hosted page, webhook signing scheme, fees (to verify) |
| **Stripe** | Strong subscription tooling (hosted Checkout, Billing, customer portal) | Is Stripe available to Thailand-registered businesses at the time of evaluation, and which local methods (PromptPay, cards) are supported (to verify)? If not available locally, is a foreign entity acceptable for tax, VAT and PDPA? |

Evaluation criteria:

- Hosted checkout only (no card data on our servers), and the resulting PCI DSS scope (to verify with the provider).
- Recurring billing: cards can be auto-charged; PromptPay QR is typically a one-off push payment, so it may need a renewal reminder with a fresh QR every period (to verify per provider).
- Webhook security: signed webhooks, replay protection, event ids to use for idempotency.
- Refunds and partial refunds through the API.
- Thai tax invoice / receipt requirements and VAT handling (to verify with an accountant).
- PDPA: data processing agreement, data location.
- Senior UX: few steps, Thai language, clear "no hidden renewal" messaging, easy cancel (UX spec screen 14).
- Fees, settlement time, chargeback handling, contract terms: all **to verify**.

## App stores: in-app purchase rules

If the subscription is a **digital service sold inside a native iOS or Android app**, Apple's App
Store Review Guidelines (in-app purchase) and Google Play's payments policy generally require
selling it through Apple In-App Purchase / Google Play Billing. Those platforms take a commission
(rate **to verify**; it depends on programme and subscription year). They also own the purchase
sheet, renewals and refunds, so the `apple_iap` and `google_play_billing` adapters will map store
server notifications to our `PaymentEvent` types instead of creating checkouts. Rules on linking
out to web checkout differ by region and change over time, so they need legal review before launch
(**to verify**). A web-only (PWA) subscription sold through a Thai gateway is outside these rules,
but the app cannot then advertise or link to it in ways the stores prohibit.

## Commands

```sh
pnpm --filter @fg/payments test
pnpm --filter @fg/payments typecheck
```
