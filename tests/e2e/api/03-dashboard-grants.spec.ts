// AC-4 / F-01 / F-02 / C-01 / AD-01 and SR-01, SR-04, SR-05: what each role may see on the dashboard.
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API, CSRF, USERS, apiAs, createPause, createScamCheck, dashboardCard, ok, resolveIds, restoreSeedGrants, safeText, type Ids,
} from '../helpers';
import type { AdminOverviewDTO, DashboardDTO, MeRes } from '../../../packages/shared/src/api';

let somsri: APIRequestContext; let nok: APIRequestContext; let anan: APIRequestContext; let pim: APIRequestContext; let admin: APIRequestContext;
let ids: Ids;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  [somsri, nok, anan, pim, admin] = await Promise.all([apiAs('somsri'), apiAs('nok'), apiAs('anan'), apiAs('pim'), apiAs('admin')]);
  ids = await resolveIds(somsri);
  await restoreSeedGrants(somsri, ids);
});
test.afterAll(async () => { for (const c of [somsri, nok, anan, pim, admin]) await c?.dispose(); });

test.describe('Anan (member with ZERO grants) — SR-01', () => {
  test("dashboard card is 'not_shared' and carries no data", async () => {
    const card = await dashboardCard(anan, ids.somsri);
    expect(card, 'Anan is a confirmed member so the card should exist').toBeTruthy();
    expect(card!.status).toBe('not_shared');
    expect(card!.visibleCategories).toEqual([]);
    expect(card!.latestCheckin ?? null).toBeNull();
    expect(card!.pendingAlerts ?? []).toEqual([]);
    expect(card!.sharedScamChecks ?? []).toEqual([]);
    expect(card!.sharedTransferPauses ?? []).toEqual([]);
    expect(card!.lastUpdatedAt ?? null, 'lastUpdatedAt must not leak activity to a zero-grant viewer (SR-03)').toBeNull();
  });

  test("status is never 'no_action_needed' for a zero-grant viewer even after senior activity", async () => {
    await ok(await somsri.post(`${API}/me/checkins`, { headers: CSRF, data: { mood: 'worried', note: 'QA-ANAN-PROBE', noteShared: true } }));
    const card = await dashboardCard(anan, ids.somsri);
    expect(card!.status).toBe('not_shared');
    expect(JSON.stringify(card)).not.toContain('QA-ANAN-PROBE');
  });

  test('every /seniors/:id/* read is refused for Anan', async () => {
    for (const p of ['checkins', 'scam-checks', 'guardian-pause']) {
      const res = await anan.get(`${API}/seniors/${ids.somsri}/${p}`);
      expect([403, 404], `${p}: ${res.status()}`).toContain(res.status());
    }
  });

  test('Anan receives no alerts for a help request', async () => {
    const alert = await ok<{ id: string }>(await somsri.post(`${API}/me/help-requests`, { headers: CSRF, data: { message: 'QA-ANAN-HELP' } }));
    const list = await ok<{ id: string }[]>(await anan.get(`${API}/alerts`));
    expect(list.map((a) => a.id)).not.toContain(alert.id);
    expect((await anan.get(`${API}/alerts/${alert.id}`)).status()).toBe(404);
    const notifs = await ok<unknown[]>(await anan.get(`${API}/notifications`));
    expect(JSON.stringify(notifs)).not.toContain('QA-ANAN-HELP');
  });
});

test.describe('Pim (caregiver) never gets scam / transfer-pause data — C-01, CAREGIVER_FORBIDDEN', () => {
  test('GET scam-checks and guardian-pause are refused', async () => {
    for (const p of ['scam-checks', 'guardian-pause']) {
      const res = await pim.get(`${API}/seniors/${ids.somsri}/${p}`);
      expect([403, 404], `${p}: ${res.status()} ${await safeText(res)}`).toContain(res.status());
    }
  });

  test('dashboard card has no scam/pause categories and no verify_possible_scam status', async () => {
    const scam = await createScamCheck(somsri);
    await ok(await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.nok] } }));
    const card = await dashboardCard(pim, ids.somsri);
    expect(card).toBeTruthy();
    expect(card!.visibleCategories).not.toContain('scam_checks');
    expect(card!.visibleCategories).not.toContain('transfer_pauses');
    expect(card!.visibleCategories).not.toContain('checkins');
    expect(card!.sharedScamChecks ?? []).toEqual([]);
    expect(card!.sharedTransferPauses ?? []).toEqual([]);
    expect(card!.latestCheckin ?? null, 'Pim has no checkins grant').toBeNull();
    expect(card!.status).not.toBe('verify_possible_scam');
  });

  for (const category of ['scam_checks', 'transfer_pauses'] as const) {
    test(`Somsri's grant of ${category} to Pim is refused with 403 (even with step-up)`, async () => {
      const res = await somsri.post(`${API}/me/grants`, { headers: CSRF, data: { granteeUserId: ids.pim, category, password: USERS.somsri.password } });
      expect(res.status(), await safeText(res)).toBe(403);
      const grants = await ok<{ granteeUserId: string; category: string; revokedAt?: string | null }[]>(await somsri.get(`${API}/me/grants`));
      expect(grants.some((g) => g.granteeUserId === ids.pim && g.category === category && !g.revokedAt)).toBe(false);
    });
  }

  test('sharing a scam check or a transfer pause with Pim is refused (SR-04)', async () => {
    const scam = await createScamCheck(somsri);
    const r1 = await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.pim] } });
    expect(r1.status(), await safeText(r1)).toBe(400);
    const pause = await createPause(somsri);
    const r2 = await somsri.post(`${API}/me/guardian-pause/${pause.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.pim] } });
    expect(r2.status(), await safeText(r2)).toBe(400);
  });
});

test.describe('Nok (granted) sees only what was shared with her — F-02, SR-04 per-recipient', () => {
  test('dashboard shows granted categories; status from approved vocabulary', async () => {
    const card = await dashboardCard(nok, ids.somsri);
    expect(card).toBeTruthy();
    expect(card!.visibleCategories).toEqual(expect.arrayContaining(['checkins', 'help_requests', 'scam_checks', 'transfer_pauses']));
    expect(['no_action_needed', 'check_in_recommended', 'assistance_requested', 'verify_possible_scam']).toContain(card!.status);
  });

  test('a shared pause appears for Nok as an amount BUCKET without exact amount or recipientNote (SR-23)', async () => {
    const res = await somsri.post(`${API}/me/guardian-pause`, {
      headers: CSRF,
      data: { amountThb: 80000, recipientNote: 'QA-RECIPIENT-NOTE', answers: { knowsRecipientPersonally: false, pressuredToActNow: true, toldToKeepSecret: true, verifiedIndependently: false } },
    });
    const pause = await ok<{ id: string }>(res);
    await ok(await somsri.post(`${API}/me/guardian-pause/${pause.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.nok] } }));
    const list = await ok<Record<string, unknown>[]>(await nok.get(`${API}/seniors/${ids.somsri}/guardian-pause`));
    const item = list.find((x) => x.id === pause.id);
    expect(item, 'shared pause visible to Nok').toBeTruthy();
    expect(item!.amountBucket).toBe('50k_200k');
    expect(item).not.toHaveProperty('amountThb');
    expect(JSON.stringify(list)).not.toContain('QA-RECIPIENT-NOTE');
    expect(JSON.stringify(list)).not.toContain('80000');
  });

  test('a scam check that was NOT shared is not visible to Nok', async () => {
    const scam = await createScamCheck(somsri, 'QA-UNSHARED ข้อความทดสอบ กรุณาโอนเงินด่วน');
    const list = await ok<{ id: string }[]>(await nok.get(`${API}/seniors/${ids.somsri}/scam-checks`));
    expect(list.map((x) => x.id)).not.toContain(scam.id);
  });

  test('grantee scam view has no submittedText / sharedWith', async () => {
    const list = await ok<Record<string, unknown>[]>(await nok.get(`${API}/seniors/${ids.somsri}/scam-checks`));
    for (const item of list) {
      expect(item).not.toHaveProperty('submittedText');
      expect(item).not.toHaveProperty('sharedWith');
    }
  });

  test('family member GET /me/members is 404 (no grant metadata of others, SR-06)', async () => {
    expect((await nok.get(`${API}/me/members`)).status()).toBe(404);
  });
});

test.describe('Admin gets no personal content — AD-01', () => {
  test('/admin/overview is counts only', async () => {
    const o = await ok<AdminOverviewDTO>(await admin.get(`${API}/admin/overview`));
    const allowed = ['users', 'families', 'notifications', 'failedDeliveriesLast24h', 'directoryUnverified', 'generatedAt'];
    for (const k of Object.keys(o)) expect(allowed, `unexpected admin field ${k}`).toContain(k);
    const s = JSON.stringify(o);
    expect(s).not.toMatch(/somsri|nok@|สมศรี|QA-|"mood"|"note"|ธนาคาร|kbank/i);
  });

  test('admin cannot read any senior content endpoint', async () => {
    for (const p of [`/seniors/${ids.somsri}/checkins`, `/seniors/${ids.somsri}/scam-checks`, `/seniors/${ids.somsri}/guardian-pause`, '/me/members', '/me/access-log']) {
      const res = await admin.get(`${API}${p}`);
      expect([403, 404], `${p}: ${res.status()}`).toContain(res.status());
    }
    const alerts = await admin.get(`${API}/alerts`);
    if (alerts.status() === 200) expect(await alerts.json()).toEqual([]);
    const meRes = await ok<MeRes>(await admin.get(`${API}/auth/me`));
    expect(meRes.circles).toEqual([]);
    const dash = await admin.get(`${API}/dashboard`);
    if (dash.status() === 200) expect(((await dash.json()) as DashboardDTO).seniors).toEqual([]);
  });
});
