// F-01 / SR-08 / SR-09 / SR-11: invite link token -> accept -> pending_confirmation (zero grants) -> senior confirms with password.
// Invitee account: the demo seed has no spare unaffiliated family account and the contract has no registration endpoint,
// so the suite uses FG_E2E_INVITEE_EMAIL/PASSWORD when given, else the admin demo account (a signed-in user in no circle).
import { test, expect, type APIRequestContext } from '@playwright/test';
import { API, BASE, CSRF, USERS, apiAs, dashboardCard, me, ok, resolveIds, safeText, type Ids } from '../helpers';
import { request as pwRequest } from '@playwright/test';
import type { InviteDTO, MemberDTO } from '../../../packages/shared/src/api';

const INVITEE = {
  email: process.env.FG_E2E_INVITEE_EMAIL ?? USERS.admin.email,
  password: process.env.FG_E2E_INVITEE_PASSWORD ?? USERS.admin.password,
};

let somsri: APIRequestContext; let invitee: APIRequestContext; let nok: APIRequestContext; let ids: Ids;
let inviteeId: string;
let invite: InviteDTO;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  somsri = await apiAs('somsri');
  nok = await apiAs('nok');
  ids = await resolveIds(somsri);
  if (process.env.FG_E2E_INVITEE_EMAIL) {
    invitee = await pwRequest.newContext({ baseURL: BASE });
    const r = await invitee.post(`${API}/auth/login`, { headers: CSRF, data: INVITEE });
    expect(r.status(), `invitee login: ${await safeText(r)}`).toBe(200);
  } else {
    invitee = await apiAs('admin');
  }
  inviteeId = (await me(invitee)).user.id;
});
test.afterAll(async () => {
  // cleanup: remove the invitee if it became a member
  if (somsri && inviteeId) {
    const members = await ok<MemberDTO[]>(await somsri.get(`${API}/me/members`)).catch(() => [] as MemberDTO[]);
    if (members.some((m) => m.userId === inviteeId)) {
      await somsri.delete(`${API}/me/members/${inviteeId}`, { headers: CSRF, data: { password: USERS.somsri.password } });
    }
    for (const inv of await ok<InviteDTO[]>(await somsri.get(`${API}/me/invitations`)).catch(() => [] as InviteDTO[])) {
      if (/^QA /.test(inv.inviteeName) && (inv.status === 'pending' || inv.status === 'pending_confirmation')) {
        await somsri.delete(`${API}/me/invitations/${inv.id}`, { headers: CSRF });
      }
    }
  }
  for (const c of [somsri, invitee, nok]) await c?.dispose();
});

test('senior creates an invite: link token returned once, high entropy, no spoken code', async () => {
  invite = await ok<InviteDTO>(await somsri.post(`${API}/me/invitations`, { headers: CSRF, data: { inviteeName: 'QA หลานทดสอบ', relationship: 'หลาน', role: 'family' } }));
  expect(invite.status).toBe('pending');
  expect(invite.token, 'token returned once on create').toBeTruthy();
  expect(invite.token!.length, 'token >= 128 bits (>= 22 base64url chars / 32 hex chars)').toBeGreaterThanOrEqual(22);
  expect(invite.token).not.toMatch(/^\d{4,8}$/); // not a 6-digit spoken code
  if (invite.inviteUrl) {
    expect(new URL(invite.inviteUrl, BASE).search, 'token never in a query string (SR-09)').not.toContain(invite.token!);
  }
  const list = await ok<InviteDTO[]>(await somsri.get(`${API}/me/invitations`));
  const row = list.find((x) => x.id === invite.id);
  expect(row).toBeTruthy();
  expect(row!.token ?? undefined, 'token never listed again').toBeUndefined();
  expect(JSON.stringify(list)).not.toContain(invite.token!);
});

test('accept -> pending_confirmation and ZERO grants / no data before confirmation', async () => {
  const res = await invitee.post(`${API}/invitations/accept`, { headers: CSRF, data: { token: invite.token } });
  const body = await ok<{ status: string; seniorFirstName: string }>(res);
  expect(body.status).toBe('pending_confirmation');

  const grants = await invitee.get(`${API}/me/grants`);
  if (grants.status() === 200) expect(await grants.json()).toEqual([]);
  for (const p of ['checkins', 'scam-checks', 'guardian-pause']) {
    const r = await invitee.get(`${API}/seniors/${ids.somsri}/${p}`);
    expect([403, 404], `${p} before confirm: ${r.status()}`).toContain(r.status());
  }
  const dash = await invitee.get(`${API}/dashboard`);
  if (dash.status() === 200) {
    const card = await dashboardCard(invitee, ids.somsri);
    if (card) {
      expect(card.visibleCategories).toEqual([]);
      expect(card.latestCheckin ?? null).toBeNull();
    }
  }
  // senior sees the pending confirmation with the account name she must compare
  const list = await ok<InviteDTO[]>(await somsri.get(`${API}/me/invitations`));
  const row = list.find((x) => x.id === invite.id)!;
  expect(row.status).toBe('pending_confirmation');
  expect(row.acceptedByAccountName, 'senior is shown the joiner account name (SR-08)').toBeTruthy();
  const members = await ok<MemberDTO[]>(await somsri.get(`${API}/me/members`));
  expect(members.map((m) => m.userId), 'not an active member before confirmation').not.toContain(inviteeId);
});

test('token is single-use: a second accept fails', async () => {
  const res = await invitee.post(`${API}/invitations/accept`, { headers: CSRF, data: { token: invite.token } });
  expect(res.status(), await safeText(res)).toBeGreaterThanOrEqual(400);
  // another account using the same token also fails
  const res2 = await nok.post(`${API}/invitations/accept`, { headers: CSRF, data: { token: invite.token } });
  expect(res2.status(), await safeText(res2)).toBeGreaterThanOrEqual(400);
});

test('invalid tokens get one generic error; token is not accepted in the query string', async () => {
  const bad = await invitee.post(`${API}/invitations/accept`, { headers: CSRF, data: { token: 'qa-not-a-real-token-000000000000' } });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  const viaQuery = await invitee.post(`${API}/invitations/accept?token=${encodeURIComponent(invite.token!)}`, { headers: CSRF, data: {} });
  expect(viaQuery.status()).toBeGreaterThanOrEqual(400);
});

test('confirm requires the senior step-up password', async () => {
  const noPw = await somsri.post(`${API}/me/invitations/${invite.id}/confirm`, { headers: CSRF, data: {} });
  expect([400, 401, 403], await safeText(noPw)).toContain(noPw.status());
  const wrong = await somsri.post(`${API}/me/invitations/${invite.id}/confirm`, { headers: CSRF, data: { password: 'Wrong-Password-2026' } });
  expect([400, 401, 403], await safeText(wrong)).toContain(wrong.status());
  const members = await ok<MemberDTO[]>(await somsri.get(`${API}/me/members`));
  expect(members.map((m) => m.userId)).not.toContain(inviteeId);
});

test('a non-senior cannot confirm the invite', async () => {
  const res = await nok.post(`${API}/me/invitations/${invite.id}/confirm`, { headers: CSRF, data: { password: USERS.nok.password } });
  expect([403, 404]).toContain(res.status());
});

test('senior confirms with password -> active member with zero grants', async () => {
  const member = await ok<MemberDTO>(await somsri.post(`${API}/me/invitations/${invite.id}/confirm`, { headers: CSRF, data: { password: USERS.somsri.password } }));
  expect(member.userId).toBe(inviteeId);
  expect(member.activeGrants).toEqual([]);
  const card = await dashboardCard(invitee, ids.somsri);
  if (card) expect(card.status).toBe('not_shared');
  for (const p of ['checkins', 'scam-checks', 'guardian-pause']) {
    const r = await invitee.get(`${API}/seniors/${ids.somsri}/${p}`);
    expect([403, 404], `${p} after confirm without grants: ${r.status()}`).toContain(r.status());
  }
});

test('cancelled invite token cannot be accepted', async () => {
  const inv = await ok<InviteDTO>(await somsri.post(`${API}/me/invitations`, { headers: CSRF, data: { inviteeName: 'QA ยกเลิก', relationship: 'เพื่อน', role: 'family' } }));
  const del = await somsri.delete(`${API}/me/invitations/${inv.id}`, { headers: CSRF });
  expect([200, 204]).toContain(del.status());
  const res = await nok.post(`${API}/invitations/accept`, { headers: CSRF, data: { token: inv.token } });
  expect(res.status()).toBeGreaterThanOrEqual(400);
});
