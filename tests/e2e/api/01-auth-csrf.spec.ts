// SR-11/SR-13/SR-15 + contract header: CSRF custom header on every mutating request; no account enumeration on login.
import { test, expect } from '@playwright/test';
import { API, CSRF, USERS, anonApi, apiAs, ok, safeText } from '../helpers';
import type { CheckinDTO } from '../../../packages/shared/src/api';

test.describe('CSRF header (x-fg-csrf) is required on mutating requests', () => {
  test('login without x-fg-csrf is refused', async () => {
    const ctx = await anonApi();
    const res = await ctx.post(`${API}/auth/login`, { data: { email: USERS.somsri.email, password: USERS.somsri.password } });
    expect([400, 403], `login w/o CSRF got ${res.status()}: ${await safeText(res)}`).toContain(res.status());
    // and no session was created
    const meRes = await ctx.get(`${API}/auth/me`);
    expect(meRes.status()).toBe(401);
    await ctx.dispose();
  });

  test('authenticated POST /me/checkins without x-fg-csrf is refused and creates nothing', async () => {
    const somsri = await apiAs('somsri');
    const before = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=90`));
    const res = await somsri.post(`${API}/me/checkins`, { data: { mood: 'happy', note: 'QA-CSRF-NO-HEADER' } });
    expect([400, 403], `got ${res.status()}: ${await safeText(res)}`).toContain(res.status());
    const after = await ok<CheckinDTO[]>(await somsri.get(`${API}/me/checkins?days=90`));
    expect(after.length).toBe(before.length);
    expect(JSON.stringify(after)).not.toContain('QA-CSRF-NO-HEADER');
    await somsri.dispose();
  });

  test('authenticated DELETE without x-fg-csrf is refused', async () => {
    const somsri = await apiAs('somsri');
    const res = await somsri.delete(`${API}/me/invitations/3f2b8c1e-9a4d-4e6b-8f1a-2c3d4e5f6a7b`);
    expect([400, 403], `got ${res.status()}: ${await safeText(res)}`).toContain(res.status());
    await somsri.dispose();
  });

  test('wrong CSRF header value is refused', async () => {
    const somsri = await apiAs('somsri');
    const res = await somsri.post(`${API}/me/checkins`, { headers: { 'x-fg-csrf': '0' }, data: { mood: 'okay' } });
    // contract: header value `1`. Any other value should not be accepted.
    expect([400, 403], `got ${res.status()}: ${await safeText(res)}`).toContain(res.status());
    await somsri.dispose();
  });
});

test.describe('Login errors do not reveal whether an account exists (SR-13)', () => {
  test('unknown email and wrong password give the same status and the same error body', async () => {
    const a = await anonApi();
    const b = await anonApi();
    const unknown = await a.post(`${API}/auth/login`, { headers: CSRF, data: { email: 'nobody-qa-7731@demo.fg', password: 'Wrong-Password-2026' } });
    const wrongPw = await b.post(`${API}/auth/login`, { headers: CSRF, data: { email: USERS.anan.email, password: 'Wrong-Password-2026' } });
    const ub = await unknown.text();
    const wb = await wrongPw.text();
    expect(unknown.status(), `unknown: ${ub}`).toBeGreaterThanOrEqual(400);
    expect(unknown.status()).toBe(wrongPw.status());
    const norm = (s: string) => { try { const j = JSON.parse(s); return JSON.stringify({ code: j?.error?.code, message: j?.error?.message }); } catch { return s; } };
    expect(norm(ub)).toBe(norm(wb));
    for (const body of [ub, wb]) {
      expect(body.toLowerCase()).not.toMatch(/not found|no such|does not exist|unknown (user|email|account)|ไม่พบบัญชี|ไม่มีบัญชี|wrong password|incorrect password/);
    }
    await a.dispose(); await b.dispose();
  });

  test('unauthenticated reads return 401', async () => {
    const ctx = await anonApi();
    for (const p of ['/auth/me', '/dashboard', '/me/checkins', '/notifications', '/admin/overview', '/me/grants']) {
      const res = await ctx.get(`${API}${p}`);
      expect(res.status(), `${p}: ${await safeText(res)}`).toBe(401);
    }
    await ctx.dispose();
  });

  test('error responses follow { error: { code, message } }', async () => {
    const ctx = await anonApi();
    const res = await ctx.get(`${API}/dashboard`);
    const body = await res.json().catch(() => null);
    expect(body?.error?.code, JSON.stringify(body)).toBeTruthy();
    expect(typeof body?.error?.message).toBe('string');
    await ctx.dispose();
  });

  test('API responses are not cacheable (SR-14)', async () => {
    const somsri = await apiAs('somsri');
    const res = await somsri.get(`${API}/auth/me`);
    expect(res.headers()['cache-control'] ?? '').toContain('no-store');
    await somsri.dispose();
  });
});
