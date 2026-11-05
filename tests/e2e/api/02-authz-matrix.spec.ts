// Full authorization matrix: Somsri / Nok / Anan / Pim / Admin × endpoints (SR-05, SR-06, SR-07, SR-13, AC-4).
// Expectations come from CONTRACT v0.2: "[senior]" endpoints are senior-of-this-family only; role violations on
// own-scope writes -> 403; resources the caller may not see -> 404; GET /me/members for other roles -> 404.
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  API, CSRF, RANDOM_UUID, ROLES_ALL, USERS, activeGrants, apiAs, createScamCheck, ensureGrant, ok, resolveIds,
  restoreSeedGrants, safeText, type Ids, type Who,
} from '../helpers';
import type { DashboardDTO, MemberDTO } from '../../../packages/shared/src/api';

type Expect = 'allow' | 'deny' | 'deny404' | 'deny403' | 'skip';
const ALLOW = [200, 201, 204];
const DENY = [403, 404];

interface Case {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: (ids: Ids, extra: Extra) => string;
  body?: (ids: Ids, who: Who) => unknown;
  expect: Record<Who, Expect>;
}
interface Extra { nokGrantId: string; scamId: string }

const seniorOnlyRead = (deny: Expect = 'deny'): Record<Who, Expect> => ({ somsri: 'allow', nok: deny, anan: deny, pim: deny, admin: deny });
const seniorOnlyWrite: Record<Who, Expect> = { somsri: 'skip', nok: 'deny', anan: 'deny', pim: 'deny', admin: 'deny' };

const CASES: Case[] = [
  { name: 'GET /auth/me', method: 'GET', path: () => '/auth/me', expect: { somsri: 'allow', nok: 'allow', anan: 'allow', pim: 'allow', admin: 'allow' } },
  { name: 'GET /me/members (SR-06)', method: 'GET', path: () => '/me/members', expect: seniorOnlyRead('deny404') },
  { name: 'GET /me/invitations', method: 'GET', path: () => '/me/invitations', expect: seniorOnlyRead() },
  { name: 'GET /me/access-log', method: 'GET', path: () => '/me/access-log', expect: seniorOnlyRead() },
  {
    name: 'POST /me/invitations (SR-05: senior only)', method: 'POST', path: () => '/me/invitations',
    body: () => ({ inviteeName: 'QA matrix invitee', relationship: 'เพื่อน', role: 'family' }), expect: seniorOnlyWrite,
  },
  {
    name: 'POST /me/grants', method: 'POST', path: () => '/me/grants',
    body: (ids, who) => ({ granteeUserId: ids.anan, category: 'help_requests', password: USERS[who].password }), expect: seniorOnlyWrite,
  },
  { name: "DELETE /me/grants/:id (Nok's grant)", method: 'DELETE', path: (_i, x) => `/me/grants/${x.nokGrantId}`, expect: seniorOnlyWrite },
  {
    name: 'DELETE /me/members/:userId (remove Nok)', method: 'DELETE', path: (ids) => `/me/members/${ids.nok}`,
    body: (_ids, who) => ({ password: USERS[who].password }), expect: seniorOnlyWrite,
  },
  { name: 'POST /me/checkins', method: 'POST', path: () => '/me/checkins', body: () => ({ mood: 'happy', note: 'QA-MATRIX' }), expect: seniorOnlyWrite },
  {
    name: 'POST /me/contacts', method: 'POST', path: () => '/me/contacts',
    body: () => ({ name: 'QA matrix contact', relationship: 'เพื่อน', phone: '081-000-0099' }), expect: seniorOnlyWrite,
  },
  { name: 'POST /me/help-requests', method: 'POST', path: () => '/me/help-requests', body: () => ({ message: 'QA-MATRIX' }), expect: seniorOnlyWrite },
  {
    name: "POST /me/scam-checks/:id/share (Somsri's item)", method: 'POST', path: (_i, x) => `/me/scam-checks/${x.scamId}/share`,
    body: (ids) => ({ shareWithUserIds: [ids.anan] }), expect: seniorOnlyWrite,
  },
  {
    name: 'GET /seniors/:id/checkins', method: 'GET', path: (ids) => `/seniors/${ids.somsri}/checkins?days=30`,
    expect: { somsri: 'skip', nok: 'allow', anan: 'deny', pim: 'deny', admin: 'deny' },
  },
  {
    name: 'GET /seniors/:id/scam-checks', method: 'GET', path: (ids) => `/seniors/${ids.somsri}/scam-checks`,
    expect: { somsri: 'skip', nok: 'allow', anan: 'deny', pim: 'deny', admin: 'deny' },
  },
  {
    name: 'GET /seniors/:id/guardian-pause', method: 'GET', path: (ids) => `/seniors/${ids.somsri}/guardian-pause`,
    expect: { somsri: 'skip', nok: 'allow', anan: 'deny', pim: 'deny', admin: 'deny' },
  },
  {
    name: 'GET /seniors/:unknownId/checkins -> 404 (SR-13)', method: 'GET', path: () => `/seniors/${RANDOM_UUID}/checkins`,
    expect: { somsri: 'deny404', nok: 'deny404', anan: 'deny404', pim: 'deny404', admin: 'deny404' },
  },
  {
    name: 'GET /alerts/:unknownId -> 404', method: 'GET', path: () => `/alerts/${RANDOM_UUID}`,
    expect: { somsri: 'deny404', nok: 'deny404', anan: 'deny404', pim: 'deny404', admin: 'deny404' },
  },
  {
    name: 'POST /alerts/:unknownId/ack -> 404', method: 'POST', path: () => `/alerts/${RANDOM_UUID}/ack`,
    expect: { somsri: 'deny404', nok: 'deny404', anan: 'deny404', pim: 'deny404', admin: 'deny404' },
  },
  { name: 'GET /dashboard', method: 'GET', path: () => '/dashboard', expect: { somsri: 'skip', nok: 'allow', anan: 'allow', pim: 'allow', admin: 'skip' } },
  { name: 'GET /admin/overview', method: 'GET', path: () => '/admin/overview', expect: { somsri: 'deny', nok: 'deny', anan: 'deny', pim: 'deny', admin: 'allow' } },
  { name: 'GET /notifications', method: 'GET', path: () => '/notifications', expect: { somsri: 'allow', nok: 'allow', anan: 'allow', pim: 'allow', admin: 'allow' } },
];

const ctxs = {} as Record<Who, APIRequestContext>;
let ids: Ids;
let extra: Extra;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  for (const w of ROLES_ALL) ctxs[w] = await apiAs(w);
  ids = await resolveIds(ctxs.somsri);
  const g = await ensureGrant(ctxs.somsri, ids.nok, 'checkins');
  const scam = await createScamCheck(ctxs.somsri);
  extra = { nokGrantId: g.id, scamId: scam.id };
});

test.afterAll(async () => {
  if (ctxs.somsri && ids) await restoreSeedGrants(ctxs.somsri, ids).catch(() => undefined);
  for (const w of ROLES_ALL) await ctxs[w]?.dispose();
});

for (const c of CASES) {
  for (const who of ROLES_ALL) {
    const exp = c.expect[who];
    if (exp === 'skip') continue;
    test(`${c.name} as ${who} -> ${exp}`, async () => {
      const ctx = ctxs[who];
      const url = `${API}${c.path(ids, extra)}`;
      const opts = { headers: CSRF, data: c.body?.(ids, who) };
      const res = c.method === 'GET' ? await ctx.get(url) : c.method === 'POST' ? await ctx.post(url, opts) : await ctx.delete(url, opts);
      const status = res.status();
      const body = await safeText(res);
      const allowed = exp === 'allow' ? ALLOW : exp === 'deny404' ? [404] : exp === 'deny403' ? [403] : DENY;
      expect(allowed, `${c.method} ${url} as ${who}: got ${status} ${body}`).toContain(status);
      if (exp !== 'allow') {
        // A denial must never carry data from the senior.
        expect(body).not.toMatch(/"mood"|"note"|"evidence"|"amountThb"|"deliveries"/);
      }
    });
  }
}

test('denied destructive calls had no effect: Nok still a member and still holds checkins', async () => {
  const members = await ok<MemberDTO[]>(await ctxs.somsri.get(`${API}/me/members`));
  expect(members.map((m) => m.userId)).toContain(ids.nok);
  const grants = await activeGrants(ctxs.somsri);
  expect(grants.find((g) => g.id === extra.nokGrantId), 'Nok checkins grant survived the denied DELETEs').toBeTruthy();
  expect(grants.find((g) => g.granteeUserId === ids.anan), 'Anan must still have zero grants').toBeFalsy();
});

test('admin /dashboard is denied or empty (operational role, no personal content)', async () => {
  const res = await ctxs.admin.get(`${API}/dashboard`);
  if (res.status() === 200) {
    const d = (await res.json()) as DashboardDTO;
    expect(d.seniors, 'admin dashboard must not list seniors').toEqual([]);
  } else {
    expect(DENY).toContain(res.status());
  }
});

test('POST /me/invitations also refused when non-senior requests a caregiver role invite', async () => {
  for (const who of ['nok', 'pim'] as Who[]) {
    const res = await ctxs[who].post(`${API}/me/invitations`, { headers: CSRF, data: { inviteeName: 'QA accomplice', relationship: 'เพื่อน', role: 'caregiver' } });
    expect(DENY, `${who}: ${res.status()}`).toContain(res.status());
  }
});

test('grantee GET /me/grants shows only own active grants, no revokedAt (SR-07)', async () => {
  for (const who of ['nok', 'pim', 'anan'] as Who[]) {
    const res = await ctxs[who].get(`${API}/me/grants`);
    expect(res.status()).toBe(200);
    const grants = (await res.json()) as Record<string, unknown>[];
    const myId = who === 'nok' ? ids.nok : who === 'pim' ? ids.pim : ids.anan;
    for (const g of grants) {
      expect(g.granteeUserId, `${who} sees someone else's grant`).toBe(myId);
      expect(g.revokedAt ?? null, `${who} sees revokedAt`).toBeNull();
      expect('revokedAt' in g && g.revokedAt !== null).toBe(false);
    }
    if (who === 'anan') expect(grants).toEqual([]);
  }
});
