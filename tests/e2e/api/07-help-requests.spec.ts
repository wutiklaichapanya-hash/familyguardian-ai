// S-07 / F-04 / SR-06 / SR-12: help requests, recipients, acknowledgement and noRecipients honesty.
import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, CSRF, apiAs, helpRequest, ok, resolveIds, restoreSeedGrants, revokeGrant, type Ids } from '../helpers';
import type { AlertDTO } from '../../../packages/shared/src/api';

let somsri: APIRequestContext; let nok: APIRequestContext; let pim: APIRequestContext; let ids: Ids;
// Not serial: each test restores grants itself, so one failure does not hide the others.
test.beforeAll(async () => {
  [somsri, nok, pim] = await Promise.all([apiAs('somsri'), apiAs('nok'), apiAs('pim')]);
  ids = await resolveIds(somsri);
  await restoreSeedGrants(somsri, ids);
});
test.afterAll(async () => {
  if (somsri && ids) await restoreSeedGrants(somsri, ids).catch(() => undefined);
  for (const c of [somsri, nok, pim]) await c?.dispose();
});

test('help request reaches Nok and Pim (help_requests grantees); senior sees all deliveries', async () => {
  const alert = await helpRequest(somsri);
  expect(alert.kind).toBe('user_requested_help');
  expect(alert.origin).toBe('user_requested');
  expect(alert.noRecipients ?? false).toBe(false);
  const recipients = alert.deliveries.map((d) => d.recipientId);
  expect(recipients).toEqual(expect.arrayContaining([ids.nok, ids.pim]));
  expect(recipients).not.toContain(ids.anan);
  for (const d of alert.deliveries) expect(['queued', 'sent', 'failed', 'seen', 'acknowledged', 'cancelled_no_consent']).toContain(d.state);
});

test('recipient view contains ONLY the caller\'s own delivery (SR-06)', async () => {
  const alert = await helpRequest(somsri, 'QA-DELIVERY-ISOLATION');
  const view = await ok<AlertDTO>(await nok.get(`${API}/alerts/${alert.id}`));
  expect(view.deliveries.every((d) => d.recipientId === ids.nok)).toBe(true);
  expect(JSON.stringify(view)).not.toContain(ids.pim);
});

test('Nok acknowledges -> senior sees acknowledgedBy Nok (AC-8)', async () => {
  const alert = await helpRequest(somsri, 'QA-ACK');
  const acked = await ok<AlertDTO>(await nok.post(`${API}/alerts/${alert.id}/ack`, { headers: CSRF }));
  expect(acked.acknowledgedBy?.userId).toBe(ids.nok);
  const mine = await ok<AlertDTO[]>(await somsri.get(`${API}/me/alerts`));
  const a = mine.find((x) => x.id === alert.id)!;
  expect(a.acknowledgedBy?.userId).toBe(ids.nok);
  expect(a.acknowledgedBy?.name).toMatch(/นก|Nok/);
  // delivery state should reach 'acknowledged' (S-07: Queued -> Sent -> Seen/Acknowledged); allow the queue 10 s
  await expect.poll(async () => {
    const m = await ok<AlertDTO[]>(await somsri.get(`${API}/me/alerts`));
    return m.find((x) => x.id === alert.id)?.deliveries.find((d) => d.recipientId === ids.nok)?.state;
  }, { timeout: 10_000 }).toBe('acknowledged');
  const logs = await ok<{ kind: string }[]>(await somsri.get(`${API}/me/action-logs`));
  expect(logs.some((l) => l.kind === 'help_request_sent')).toBe(true);
});

test('without any help_requests grantee -> noRecipients=true, deliveries=[], never "sent" (SR-12)', async () => {
  await revokeGrant(somsri, ids.nok, 'help_requests');
  await revokeGrant(somsri, ids.pim, 'help_requests');
  try {
    const alert = await helpRequest(somsri, 'QA-NO-RECIPIENTS');
    expect(alert.noRecipients).toBe(true);
    expect(alert.deliveries).toEqual([]);
    expect(JSON.stringify(alert)).not.toMatch(/"state":"sent"/);
    const mine = await ok<AlertDTO[]>(await somsri.get(`${API}/me/alerts`));
    const a = mine.find((x) => x.id === alert.id);
    expect(a?.deliveries ?? []).toEqual([]);
    // nobody received it
    const nokAlerts = await ok<AlertDTO[]>(await nok.get(`${API}/alerts`));
    expect(nokAlerts.map((x) => x.id)).not.toContain(alert.id);
    expect((await pim.get(`${API}/alerts/${alert.id}`)).status()).toBe(404);
  } finally {
    await restoreSeedGrants(somsri, ids);
  }
});

test('after revoke of help_requests an earlier alert can no longer be read or acknowledged (grant re-checked)', async () => {
  const alert = await helpRequest(somsri, 'QA-RECHECK');
  expect((await pim.get(`${API}/alerts/${alert.id}`)).status()).toBe(200);
  await revokeGrant(somsri, ids.pim, 'help_requests');
  try {
    expect((await pim.get(`${API}/alerts/${alert.id}`)).status()).toBe(404);
    expect((await pim.post(`${API}/alerts/${alert.id}/ack`, { headers: CSRF })).status()).toBe(404);
  } finally {
    await restoreSeedGrants(somsri, ids);
  }
});

test('call log records call_started_from_app, never "connected" (AC-7)', async () => {
  const contacts = await ok<{ id: string }[]>(await somsri.get(`${API}/me/contacts`));
  expect(contacts.length, 'seed provides trusted contacts').toBeGreaterThan(0);
  const log = await ok<{ kind: string; label: string }>(await somsri.post(`${API}/me/call-logs`, { headers: CSRF, data: { contactId: contacts[0].id } }));
  expect(log.kind).toBe('call_started_from_app');
  expect(log.label.toLowerCase()).not.toMatch(/connected|completed|เชื่อมต่อแล้ว|โทรสำเร็จ/);
});

test('call log ignores a client-supplied phone number (SR-17)', async () => {
  const res = await somsri.post(`${API}/me/call-logs`, { headers: CSRF, data: { phone: '081-000-0666' } });
  if (res.ok()) expect(await res.text()).not.toContain('081-000-0666');
  else expect(res.status()).toBe(400);
});

test('emergency directory numbers carry needs_human_verification unless verified', async () => {
  const dir = await ok<{ phone: string; verification: string; verifiedAt?: string | null }[]>(await somsri.get(`${API}/directory?country=TH`));
  const phones = dir.map((d) => d.phone);
  expect(phones).toEqual(expect.arrayContaining(['1669', '191', '1441']));
  for (const d of dir) {
    if (d.verification === 'verified') expect(d.verifiedAt).toBeTruthy();
    else expect(d.verification).toBe('needs_human_verification');
  }
});
