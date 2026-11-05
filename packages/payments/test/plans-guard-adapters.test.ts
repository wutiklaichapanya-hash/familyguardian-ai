import { describe, expect, it } from 'vitest';
import {
  AppleIapProvider,
  assertLiveAllowed,
  CardProvider,
  ENTITLEMENTS,
  entitlementsFor,
  GooglePlayBillingProvider,
  isLiveAllowed,
  LivePaymentsDisabledError,
  NOT_ENABLED_MESSAGE,
  PLANS,
  PromptPayProvider,
  ShopeePayProvider,
  TrueMoneyProvider,
} from '../src';

describe('plans', () => {
  it('has free ฿0, family_care ฿199, guardian_plus ฿349, all flagged as hypotheses', () => {
    expect(PLANS.map((p) => [p.id, p.priceThbMonthly])).toEqual([
      ['free', 0],
      ['family_care', 199],
      ['guardian_plus', 349],
    ]);
    for (const p of PLANS) {
      expect(p.hypothesis).toBe(true);
      expect(p.features.length).toBeGreaterThan(0);
      expect(p.name.th && p.name.en).toBeTruthy();
      expect(p.features).toContain('help_request');
    }
  });
});

describe('entitlements', () => {
  it('has an entry for every plan', () => {
    expect(Object.keys(ENTITLEMENTS).sort()).toEqual(PLANS.map((p) => p.id).sort());
  });
  it('free has limits; paid plans unlock more; guardian_plus is a superset of family_care', () => {
    const free = entitlementsFor('free');
    const fc = entitlementsFor('family_care');
    const gp = entitlementsFor('guardian_plus');
    expect(free).toMatchObject({ guardianPause: true, careTasks: false });
    expect(fc).toMatchObject({ guardianPause: true, careTasks: false });
    expect(gp).toMatchObject({ guardianPause: true, careTasks: true, caregiverAccess: true });
    expect(fc.maxFamilyMembers).toBeGreaterThan(free.maxFamilyMembers);
    expect(gp.maxFamilyMembers).toBeGreaterThan(fc.maxFamilyMembers);
    expect(gp.scamChecksPerDay).toBeGreaterThan(fc.scamChecksPerDay);
    expect(fc.scamChecksPerDay).toBeGreaterThan(free.scamChecksPerDay);
  });
  it('help is never gated on any plan', () => {
    for (const p of PLANS) {
      expect(entitlementsFor(p.id)).toMatchObject({ helpRequests: true, officialHelpNumbers: true });
    }
  });
  it('unknown plan falls back to free; returned objects are copies', () => {
    expect(entitlementsFor('platinum')).toEqual(entitlementsFor('free'));
    expect(entitlementsFor(null)).toEqual(entitlementsFor('free'));
    const e = entitlementsFor('guardian_plus');
    e.maxFamilyMembers = 999;
    expect(entitlementsFor('guardian_plus').maxFamilyMembers).not.toBe(999);
  });
});

describe('assertLiveAllowed', () => {
  const ok = {
    PAYMENTS_MODE: 'live',
    PAYMENTS_PROVIDER_KEY: 'test_key_placeholder',
    PAYMENTS_WEBHOOK_SECRET: 'test_whsec_placeholder',
    RELEASE_PAYMENTS_SIGNED: 'true',
  };
  it('passes only when mode=live AND credentials present AND release signed', () => {
    expect(() => assertLiveAllowed(ok)).not.toThrow();
    expect(isLiveAllowed(ok)).toBe(true);
  });
  it.each([
    ['sandbox mode', { PAYMENTS_MODE: 'sandbox' }],
    ['mode unset', { PAYMENTS_MODE: undefined }],
    ['missing provider key', { PAYMENTS_PROVIDER_KEY: undefined }],
    ['blank webhook secret', { PAYMENTS_WEBHOOK_SECRET: '  ' }],
    ['release unsigned', { RELEASE_PAYMENTS_SIGNED: 'false' }],
    ['release flag truthy but not exactly "true"', { RELEASE_PAYMENTS_SIGNED: 'TRUE' }],
  ])('throws when %s', (_label, override) => {
    expect(() => assertLiveAllowed({ ...ok, ...override })).toThrow(LivePaymentsDisabledError);
  });
  it('throws on an empty env and lists every blocker', () => {
    try {
      assertLiveAllowed({});
      throw new Error('should not reach');
    } catch (e) {
      expect(e).toBeInstanceOf(LivePaymentsDisabledError);
      expect((e as LivePaymentsDisabledError).reasons).toHaveLength(4);
    }
  });
});

describe('live adapter stubs', () => {
  const adapters = [
    [new PromptPayProvider(), 'promptpay'],
    [new CardProvider(), 'card'],
    [new TrueMoneyProvider(), 'truemoney'],
    [new ShopeePayProvider(), 'shopeepay'],
    [new AppleIapProvider(), 'apple_iap'],
    [new GooglePlayBillingProvider(), 'google_play_billing'],
  ] as const;
  it.each(adapters)('%o (%s) throws NOT_ENABLED on every method', (a, id) => {
    expect(a.id).toBe(id);
    expect(() => a.createCheckout({ planId: 'family_care', payerUserId: 'u', familyId: 'f' })).toThrow(NOT_ENABLED_MESSAGE);
    expect(() => a.verifyWebhook('{}', {})).toThrow(NOT_ENABLED_MESSAGE);
    expect(() => a.parseEvent('{}')).toThrow(NOT_ENABLED_MESSAGE);
    expect(() => a.refund({ subscriptionId: 's' })).toThrow(NOT_ENABLED_MESSAGE);
  });
});
