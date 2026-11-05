// SR-04 (share only to eligible grantees, per recipient) and F-03 / SR-07 (revoke -> 404, contentUnavailable).
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API, CSRF, RANDOM_UUID, apiAs, createPause, createScamCheck, ensureGrant, ok, resolveIds, restoreSeedGrants, revokeGrant, safeText, type Ids,
} from '../helpers';
import type { AlertDTO, NotificationDTO, ScamAssessmentDTO } from '../../../packages/shared/src/api';

let somsri: APIRequestContext; let nok: APIRequestContext; let anan: APIRequestContext; let ids: Ids;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  [somsri, nok, anan] = await Promise.all([apiAs('somsri'), apiAs('nok'), apiAs('anan')]);
  ids = await resolveIds(somsri);
  await restoreSeedGrants(somsri, ids);
});
test.afterAll(async () => {
  if (somsri && ids) await restoreSeedGrants(somsri, ids).catch(() => undefined);
  for (const c of [somsri, nok, anan]) await c?.dispose();
});

test.describe('Share to a non-grantee is refused (SR-04)', () => {
  test('scam check share to Anan (member, no grant) -> 400', async () => {
    const scam = await createScamCheck(somsri);
    const res = await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.anan] } });
    expect(res.status(), await safeText(res)).toBe(400);
  });

  test('scam check share to a non-member id -> 400', async () => {
    const scam = await createScamCheck(somsri);
    const res = await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [RANDOM_UUID] } });
    expect(res.status(), await safeText(res)).toBe(400);
    const res2 = await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.admin] } });
    expect(res2.status(), await safeText(res2)).toBe(400);
  });

  test('mixed list [Nok, Anan] is rejected as a whole; Nok does not receive it', async () => {
    const scam = await createScamCheck(somsri);
    const res = await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.nok, ids.anan] } });
    expect(res.status(), await safeText(res)).toBe(400);
    const list = await ok<{ id: string }[]>(await nok.get(`${API}/seniors/${ids.somsri}/scam-checks`));
    expect(list.map((x) => x.id)).not.toContain(scam.id);
    const own = await ok<ScamAssessmentDTO[]>(await somsri.get(`${API}/me/scam-checks`));
    expect(own.find((x) => x.id === scam.id)?.sharedWith ?? []).toEqual([]);
  });

  test('guardian-pause share to Anan -> 400 (same rule, transfer_pauses)', async () => {
    const pause = await createPause(somsri);
    const res = await somsri.post(`${API}/me/guardian-pause/${pause.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.anan] } });
    expect(res.status(), await safeText(res)).toBe(400);
  });

  test('error for a refused share reveals nothing per user', async () => {
    const scam = await createScamCheck(somsri);
    const res = await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.anan] } });
    const body = await res.text();
    expect(body).not.toContain(ids.anan);
    expect(body).not.toMatch(/อนันต์|Anan/);
  });

  test('a valid share to Nok works and is visible only to Nok', async () => {
    const scam = await createScamCheck(somsri);
    const shared = await ok<ScamAssessmentDTO>(await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.nok] } }));
    expect(shared.sharedWith).toEqual([ids.nok]);
    const list = await ok<{ id: string }[]>(await nok.get(`${API}/seniors/${ids.somsri}/scam-checks`));
    expect(list.map((x) => x.id)).toContain(scam.id);
  });
});

test.describe('Revoke stops access (F-03, SR-07)', () => {
  test('revoke checkins -> Nok next read is 404', async () => {
    await ensureGrant(somsri, ids.nok, 'checkins');
    expect((await nok.get(`${API}/seniors/${ids.somsri}/checkins`)).status()).toBe(200);
    await revokeGrant(somsri, ids.nok, 'checkins');
    const res = await nok.get(`${API}/seniors/${ids.somsri}/checkins`);
    expect(res.status(), await safeText(res)).toBe(404);
    const card = (await ok<{ seniors: { seniorId: string; visibleCategories: string[]; latestCheckin?: unknown }[] }>(await nok.get(`${API}/dashboard`)))
      .seniors.find((s) => s.seniorId === ids.somsri);
    expect(card?.visibleCategories ?? []).not.toContain('checkins');
    expect(card?.latestCheckin ?? null).toBeNull();
    // grantee grant list no longer shows it, and never shows revokedAt
    const grants = await ok<Record<string, unknown>[]>(await nok.get(`${API}/me/grants`));
    expect(grants.some((g) => g.category === 'checkins')).toBe(false);
    expect(JSON.stringify(grants)).not.toContain('revokedAt":"');
  });

  test('revoke scam_checks after a share -> item, alert 404 and the notification becomes contentUnavailable', async () => {
    await ensureGrant(somsri, ids.nok, 'scam_checks');
    const scam = await createScamCheck(somsri);
    await ok(await somsri.post(`${API}/me/scam-checks/${scam.id}/share`, { headers: CSRF, data: { shareWithUserIds: [ids.nok] } }));

    // Nok has an alert + a notification for it
    const alerts = await ok<AlertDTO[]>(await nok.get(`${API}/alerts`));
    const alert = alerts.filter((a) => a.kind === 'shared_scam_check').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    expect(alert, 'sharing creates an alert for the recipient').toBeTruthy();
    let notifs = await ok<NotificationDTO[]>(await nok.get(`${API}/notifications`));
    const n = notifs.find((x) => x.alertId === alert.id);
    expect(n, 'a notification exists for the shared alert').toBeTruthy();
    expect(n!.contentUnavailable).toBe(false);

    await revokeGrant(somsri, ids.nok, 'scam_checks');

    expect((await nok.get(`${API}/seniors/${ids.somsri}/scam-checks`)).status()).toBe(404);
    expect((await nok.get(`${API}/alerts/${alert.id}`)).status()).toBe(404);
    expect((await nok.post(`${API}/alerts/${alert.id}/ack`, { headers: CSRF })).status()).toBe(404);
    const list = await ok<AlertDTO[]>(await nok.get(`${API}/alerts`));
    expect(list.map((a) => a.id)).not.toContain(alert.id);

    notifs = await ok<NotificationDTO[]>(await nok.get(`${API}/notifications`));
    const after = notifs.find((x) => x.id === n!.id);
    if (after) {
      expect(after.contentUnavailable).toBe(true);
      const text = `${after.title} ${after.body}`;
      expect(text, 'no detail of the revoked item in the notification body').not.toMatch(/kbank|OTP|กสิกร|ธนาคาร/i);
      expect(text.toLowerCase(), 'same copy for revoke and expiry — must not name the cause').not.toMatch(/revok|ยกเลิกสิทธิ์|เพิกถอน|หยุดแชร์/);
      expect(JSON.stringify(after)).not.toMatch(/contentRevoked/);
    }
  });

  test('same 404 body for "revoked" and "never existed" (SR-07/SR-13)', async () => {
    const revoked = await nok.get(`${API}/seniors/${ids.somsri}/scam-checks`);
    const never = await nok.get(`${API}/seniors/${RANDOM_UUID}/scam-checks`);
    expect(revoked.status()).toBe(404);
    expect(never.status()).toBe(404);
    const norm = async (r: typeof revoked) => { const j = await r.json().catch(() => ({})); return j?.error?.code; };
    expect(await norm(revoked)).toBe(await norm(never));
  });

  test('re-grant restores access', async () => {
    await restoreSeedGrants(somsri, ids);
    expect((await nok.get(`${API}/seniors/${ids.somsri}/checkins`)).status()).toBe(200);
  });

  test('sensitive grant (scam_checks) without step-up password is refused', async () => {
    await revokeGrant(somsri, ids.nok, 'transfer_pauses');
    const res = await somsri.post(`${API}/me/grants`, { headers: CSRF, data: { granteeUserId: ids.nok, category: 'transfer_pauses' } });
    expect([400, 401, 403], await safeText(res)).toContain(res.status());
    const wrong = await somsri.post(`${API}/me/grants`, { headers: CSRF, data: { granteeUserId: ids.nok, category: 'transfer_pauses', password: 'not-the-password' } });
    expect([400, 401, 403], await safeText(wrong)).toContain(wrong.status());
    await ensureGrant(somsri, ids.nok, 'transfer_pauses');
  });
});
