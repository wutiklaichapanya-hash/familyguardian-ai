// P1 sandbox billing via @fg/payments.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signSandboxPayload } from '@fg/payments';
import { setupEnv, json, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => { env = await setupEnv(); });
afterAll(async () => { await env.close(); });

const SECRET = 'test-sandbox-secret';
const hook = (body: object, sig?: string) => {
  const raw = JSON.stringify(body);
  return env.app.inject({ method: 'POST', url: '/api/v1/webhooks/payments/sandbox', headers: { 'content-type': 'application/json', 'x-fg-signature': sig ?? signSandboxPayload(raw, SECRET) }, payload: raw });
};

describe('billing (sandbox)', () => {
  it('lists plans and starts a sandbox checkout', async () => {
    const plans = json<any[]>(await (await env.as('nok')).get('/billing/plans'));
    expect(plans.map((p) => p.id)).toEqual(expect.arrayContaining(['free', 'family_care', 'guardian_plus']));
    const r = json(await (await env.as('nok')).post('/me/subscription/checkout', { planId: 'family_care' }));
    expect(r.sandbox).toBe(true);
    expect(r.checkoutUrl.startsWith('http://localhost:3100/sandbox/checkout')).toBe(true);
    expect(json(await (await env.as('nok')).get('/me/subscription'))).toBeNull();
  });

  it('webhook: HMAC required, applies events idempotently, cancel works', async () => {
    const ev = { id: 'evt_1', type: 'checkout.completed', created: new Date().toISOString(), data: { payerUserId: env.ids.nok, familyId: env.familyId, planId: 'family_care', subscriptionId: 'sbx_sub_test1' } };
    expect((await hook(ev, '0'.repeat(64))).statusCode).toBe(401);
    const first = await hook(ev);
    expect(first.statusCode).toBe(200);
    expect(json(first).duplicate).toBe(false);
    expect(json(await hook(ev)).duplicate).toBe(true);
    expect(json(await (await env.as('somsri')).get('/me/subscription')).status).toBe('trialing');
    const stale = await hook({ ...ev, id: 'evt_old', type: 'invoice.paid', created: new Date(Date.now() - 3_600_000).toISOString() });
    expect(stale.statusCode).toBe(400);
    const bogus = await hook({ ...ev, id: 'evt_bogus', data: { ...ev.data, familyId: '00000000-0000-4000-8000-000000000000' } });
    expect(bogus.statusCode).toBe(400);
    const c = json(await (await env.as('nok')).post('/me/subscription/cancel'));
    expect(c.status).toBe('canceled');
  });
});
