import { describe, expect, it } from 'vitest';
import {
  createSandboxCheckout,
  parseSandboxEvent,
  PaymentEventParseError,
  SandboxProvider,
  signSandboxPayload,
  verifySandboxWebhook,
} from '../src';

const SECRET = 'test_only_sandbox_secret';
const body = JSON.stringify({
  id: 'evt_1',
  type: 'checkout.completed',
  created: '2026-11-01T00:00:00.000Z',
  data: { payerUserId: 'u_nok', familyId: 'fam_1', planId: 'family_care', sessionId: 'sbx_cs_1' },
});

describe('sandbox webhook signature', () => {
  it('accepts a valid signature', () => {
    expect(verifySandboxWebhook(body, signSandboxPayload(body, SECRET), SECRET)).toBe(true);
  });
  it('accepts uppercase hex of a valid signature', () => {
    expect(verifySandboxWebhook(body, signSandboxPayload(body, SECRET).toUpperCase(), SECRET)).toBe(true);
  });
  it('rejects a signature made with another secret', () => {
    expect(verifySandboxWebhook(body, signSandboxPayload(body, 'other'), SECRET)).toBe(false);
  });
  it('rejects malformed / empty / wrong-length signatures without throwing', () => {
    expect(verifySandboxWebhook(body, '', SECRET)).toBe(false);
    expect(verifySandboxWebhook(body, 'not-hex', SECRET)).toBe(false);
    expect(verifySandboxWebhook(body, 'ab'.repeat(16), SECRET)).toBe(false);
    expect(verifySandboxWebhook(body, signSandboxPayload(body, SECRET), '')).toBe(false);
  });
  it('rejects a tampered body', () => {
    const sig = signSandboxPayload(body, SECRET);
    const tampered = body.replace('family_care', 'guardian_plus');
    expect(tampered).not.toBe(body);
    expect(verifySandboxWebhook(tampered, sig, SECRET)).toBe(false);
    expect(verifySandboxWebhook(body + ' ', sig, SECRET)).toBe(false);
  });
  it('rejects a tampered signature (one nibble flipped)', () => {
    const sig = signSandboxPayload(body, SECRET);
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    expect(verifySandboxWebhook(body, flipped, SECRET)).toBe(false);
  });
  it('SandboxProvider.verifyWebhook reads x-fg-signature case-insensitively', () => {
    const p = new SandboxProvider(SECRET);
    const sig = signSandboxPayload(body, SECRET);
    expect(p.verifyWebhook(body, { 'x-fg-signature': sig })).toBe(true);
    expect(p.verifyWebhook(body, { 'X-FG-Signature': sig })).toBe(true);
    expect(p.verifyWebhook(body, {})).toBe(false);
    expect(p.verifyWebhook(body, { 'x-fg-signature': 'deadbeef' })).toBe(false);
  });
});

describe('sandbox checkout', () => {
  it('returns a local sandbox URL plus sessionId', async () => {
    const p = new SandboxProvider(SECRET, { idFactory: () => 'fixed' });
    const s = await p.createCheckout({ planId: 'guardian_plus', payerUserId: 'u_nok', familyId: 'fam_1' });
    expect(s.sandbox).toBe(true);
    expect(s.sessionId).toBe('sbx_cs_fixed');
    const url = new URL(s.checkoutUrl);
    expect(url.hostname).toBe('localhost');
    expect(url.searchParams.get('session')).toBe('sbx_cs_fixed');
    expect(url.searchParams.get('plan')).toBe('guardian_plus');
  });
  it('refuses checkout for the free plan or unknown plans', () => {
    expect(() => createSandboxCheckout({ planId: 'free', payerUserId: 'u', familyId: 'f' })).toThrow(PaymentEventParseError);
    expect(() => createSandboxCheckout({ planId: 'gold' as never, payerUserId: 'u', familyId: 'f' })).toThrow();
  });
  it('sandbox refund returns a sandbox refund id', async () => {
    const r = await new SandboxProvider(SECRET).refund({ subscriptionId: 'sub_1' });
    expect(r.sandbox).toBe(true);
    expect(r.refundId).toMatch(/^sbx_re_/);
  });
});

describe('parseSandboxEvent', () => {
  it('parses all five supported event types', () => {
    for (const type of ['checkout.completed', 'invoice.paid', 'invoice.payment_failed', 'subscription.canceled', 'charge.refunded']) {
      const ev = parseSandboxEvent(JSON.stringify({ id: `e_${type}`, type, data: { payerUserId: 'u', familyId: 'f' } }));
      expect(ev.type).toBe(type);
      expect(ev.provider).toBe('sandbox');
    }
  });
  it('rejects bad payloads', () => {
    expect(() => parseSandboxEvent('{not json')).toThrow(PaymentEventParseError);
    expect(() => parseSandboxEvent(JSON.stringify({ id: 'e', type: 'invoice.voided', data: { payerUserId: 'u', familyId: 'f' } }))).toThrow(/Unsupported/);
    expect(() => parseSandboxEvent(JSON.stringify({ type: 'invoice.paid', data: { payerUserId: 'u', familyId: 'f' } }))).toThrow(/event id/);
    expect(() => parseSandboxEvent(JSON.stringify({ id: 'e', type: 'invoice.paid', data: {} }))).toThrow(/payerUserId/);
  });
});
