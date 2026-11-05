/**
 * @fg/payments — entitlements separated from payment providers.
 * Pure TypeScript, no network. Only the SandboxProvider is functional; every live adapter is a
 * stub that throws NOT_ENABLED. We never store card data: hosted checkout only, now and later.
 */
export * from './plans';
export * from './types';
export * from './sandbox';
export * from './lifecycle';
export * from './live-guard';
export * from './adapters/not-enabled';
export { PromptPayProvider } from './adapters/promptpay';
export { CardProvider } from './adapters/card';
export { TrueMoneyProvider } from './adapters/truemoney';
export { ShopeePayProvider } from './adapters/shopeepay';
export { AppleIapProvider } from './adapters/apple-iap';
export { GooglePlayBillingProvider } from './adapters/google-play-billing';
