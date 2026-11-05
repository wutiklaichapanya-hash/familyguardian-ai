// CONTRACT v0.3 additions: DELETE /me/checkins/:id (undo within CHECKIN_UNDO_WINDOW_MINUTES, else 409 'undo_window_passed')
// and POST /auth/register (same 202 for new and existing emails, no sign-in, weak password -> 400 'weak_password').
// The API offers no clock override, so the "after the window" path uses a seeded check-in that is days old.
import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, CSRF, RANDOM_UUID, USERS, anonApi, apiAs, createCheckin, dashboardCard, ensureGrant, ok, resolveIds, safeText, type Ids } from '../helpers';
import { CHECKIN_UNDO_WINDOW_MINUTES, type CheckinDTO, type SharedCheckinDTO } from '../../../packages/shared/src/api';

let somsri: APIRequestContext; let nok: APIRequestContext; let ids: Ids;
test.beforeAll(async () => {
  [somsri, nok] = await Promise.all([apiAs('somsri'), apiAs('nok')]);
  ids = await resolveIds(somsri);
  await ensureGrant(somsri, ids.nok, 'checkins');
});
test.afterAll(async () => { await somsri?.dispose(); await nok?.dispose(); });

test.describe('Undo a check-in (v0.3)', () => {
  test('within the window: 204, row gone for the senior AND for Nok, dashboard no longer shows it', async () => {
    const marker = `QA-UNDO-${Date.now()}`;
    const c = await createCheckin(somsri, { mood: 'worried', note: marker, noteShared: true });
    const before = await ok<SharedCheckinDTO[]>(await nok.get(`${API}/seniors/${ids.somsri}/checkins?days=30`));
    expect(before.map((x) => x.id), 'shared check-in visible to Nok before undo').toContain(c.id);

    const del = await somsri.delete(`${API}/me/checkins/${c.id}`, { headers: CSRF });
    expect(del.status(), await safeText(del)).toBe(204);

    const own = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=30`));
    expect(own.map((x) => x.id)).not.toContain(c.id);
    const shared = await ok<SharedCheckinDTO[]>(await nok.get(`${API}/seniors/${ids.somsri}/checkins?days=30`));
    expect(shared.map((x) => x.id)).not.toContain(c.id);
    expect(JSON.stringify(shared)).not.toContain(marker);
    const card = await dashboardCard(nok, ids.somsri);
    expect(JSON.stringify(card)).not.toContain(marker);
    expect(card!.latestCheckin?.at ?? null).not.toBe(c.createdAt);
  });

  test('a second undo of the same id is 404 (hard-deleted)', async () => {
    const c = await createCheckin(somsri, { mood: 'okay' });
    expect((await somsri.delete(`${API}/me/checkins/${c.id}`, { headers: CSRF })).status()).toBe(204);
    expect((await somsri.delete(`${API}/me/checkins/${c.id}`, { headers: CSRF })).status()).toBe(404);
  });

  test(`after ${CHECKIN_UNDO_WINDOW_MINUTES} minutes: 409 undo_window_passed and the row stays (seeded, days-old check-in)`, async () => {
    const own = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=30`));
    const old = own.find((x) => Date.now() - new Date(x.createdAt).getTime() > (CHECKIN_UNDO_WINDOW_MINUTES + 1) * 60_000);
    expect(old, 'seed provides an old check-in').toBeTruthy();
    const res = await somsri.delete(`${API}/me/checkins/${old!.id}`, { headers: CSRF });
    expect(res.status(), await safeText(res)).toBe(409);
    expect((await res.json())?.error?.code).toBe('undo_window_passed');
    const after = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=30`));
    expect(after.map((x) => x.id)).toContain(old!.id);
  });

  test("Nok cannot undo Somsri's check-in (403/404) and it survives", async () => {
    const c = await createCheckin(somsri, { mood: 'happy' });
    const res = await nok.delete(`${API}/me/checkins/${c.id}`, { headers: CSRF });
    expect([403, 404], await safeText(res)).toContain(res.status());
    const own = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=30`));
    expect(own.map((x) => x.id)).toContain(c.id);
  });

  test('undo without x-fg-csrf is refused; unknown id is 404', async () => {
    const c = await createCheckin(somsri, { mood: 'tired' });
    const noCsrf = await somsri.delete(`${API}/me/checkins/${c.id}`);
    expect([400, 403]).toContain(noCsrf.status());
    const own = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=30`));
    expect(own.map((x) => x.id)).toContain(c.id);
    expect((await somsri.delete(`${API}/me/checkins/${RANDOM_UUID}`, { headers: CSRF })).status()).toBe(404);
  });
});

test.describe('Register (v0.3, demo) — no account enumeration', () => {
  // REGISTER_RATE_LIMIT_MAX defaults to 5 per hour per IP: this block makes 3 counted calls.
  test('new and existing emails get the same 202 body; register does not sign in; weak password -> 400', async () => {
    const a = await anonApi();
    const b = await anonApi();
    const fresh = `qa-reg-${Date.now()}@demo.fg`;
    const strong = 'Blue-Kettle-Morning-2026!';
    const r1 = await a.post(`${API}/auth/register`, { headers: CSRF, data: { email: fresh, password: strong, displayName: 'QA Register', role: 'family' } });
    const r2 = await b.post(`${API}/auth/register`, { headers: CSRF, data: { email: USERS.nok.email, password: strong, displayName: 'QA Register', role: 'family' } });
    const t1 = await r1.text(); const t2 = await r2.text();
    expect(r1.status(), t1).toBe(202);
    expect(r2.status(), t2).toBe(202);
    expect(JSON.parse(t1).status).toBe('accepted');
    expect(t2, 'identical body for existing email').toBe(t1);
    // no session was created by register
    expect((await a.get(`${API}/auth/me`)).status()).toBe(401);
    expect((await b.get(`${API}/auth/me`)).status()).toBe(401);
    // the existing account was not changed: Nok can still sign in with her own password
    const n = await apiAs('nok');
    expect((await n.get(`${API}/auth/me`)).status()).toBe(200);
    await n.dispose();

    const weak = await a.post(`${API}/auth/register`, { headers: CSRF, data: { email: `qa-weak-${Date.now()}@demo.fg`, password: 'password1', displayName: 'QA Weak', role: 'family' } });
    expect(weak.status(), await safeText(weak)).toBe(400);
    expect((await weak.json())?.error?.code).toBe('weak_password');
    await a.dispose(); await b.dispose();
  });

  test('register without x-fg-csrf is refused', async () => {
    const a = await anonApi();
    const r = await a.post(`${API}/auth/register`, { data: { email: `qa-nocsrf-${Date.now()}@demo.fg`, password: 'Blue-Kettle-Morning-2026!', displayName: 'QA', role: 'family' } });
    expect([400, 403, 429]).toContain(r.status());
    expect(r.status()).not.toBe(202);
    await a.dispose();
  });

  test('register cannot create privileged roles', async () => {
    const a = await anonApi();
    const r = await a.post(`${API}/auth/register`, { headers: CSRF, data: { email: `qa-admin-${Date.now()}@demo.fg`, password: 'Blue-Kettle-Morning-2026!', displayName: 'QA', role: 'admin' } });
    expect([400, 429], await safeText(r)).toContain(r.status());
    await a.dispose();
  });
});
