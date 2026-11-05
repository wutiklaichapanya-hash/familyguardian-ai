// Authorisation matrix: role × category × grant state {active, expired, revoked, none}.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { CAREGIVER_FORBIDDEN, SHARE_CATEGORIES, type ShareCategory } from '@fg/shared';
import { accessLogs, consentGrants, familyMemberships, users } from '../src/db/schema';
import { setupEnv, json, createUser, type TestEnv } from './helpers';

let env: TestEnv;
let outsiderId: string;
let pendingId: string;
beforeAll(async () => {
  env = await setupEnv();
  outsiderId = (await createUser(env.db, 'outsider@test.fg')).id;
  pendingId = (await createUser(env.db, 'pending@test.fg')).id;
  await env.db.insert(familyMemberships).values({ familyId: env.familyId, userId: pendingId, role: 'family', relationship: 'niece', status: 'pending_confirmation' });
});
afterAll(async () => { await env.close(); });

type State = 'active' | 'expired' | 'revoked' | 'none';
const STATES: State[] = ['active', 'expired', 'revoked', 'none'];
const DAY = 86_400_000;

async function setGrant(granteeId: string, category: ShareCategory, state: State) {
  await env.db.delete(consentGrants).where(and(eq(consentGrants.granteeUserId, granteeId), eq(consentGrants.category, category)));
  if (state === 'none') return;
  const now = Date.now();
  await env.db.insert(consentGrants).values({
    familyId: env.familyId, seniorId: env.ids.somsri, granteeUserId: granteeId, category, createdBy: env.ids.somsri, consentTextVersion: 'consent-v1',
    createdAt: new Date(now - 10 * DAY),
    expiresAt: new Date(state === 'expired' ? now - DAY : now + 30 * DAY),
    revokedAt: state === 'revoked' ? new Date(now - 1000) : null,
  });
}

const READ_ROUTES: Partial<Record<ShareCategory, string>> = {
  checkins: 'checkins', scam_checks: 'scam-checks', transfer_pauses: 'guardian-pause', contacts: 'contacts',
};

describe('authorization matrix', () => {
  const roles = () => [
    { name: 'family (Anan)', id: env.ids.anan, role: 'family' as const, member: true },
    { name: 'caregiver (Pim)', id: env.ids.pim, role: 'caregiver' as const, member: true },
    { name: 'admin', id: env.ids.admin, role: 'admin' as const, member: false },
    { name: 'outsider', id: outsiderId, role: 'family' as const, member: false },
    { name: 'pending member', id: pendingId, role: 'family' as const, member: false },
  ];

  it('role × category × grant state — policy.authorize and HTTP reads agree', async () => {
    const rows: string[] = [];
    for (const r of roles()) {
      const client = await env.asUser(r.id);
      for (const category of SHARE_CATEGORIES) {
        for (const state of STATES) {
          await setGrant(r.id, category, state);
          const expected = state === 'active' && r.member && !(r.role === 'caregiver' && CAREGIVER_FORBIDDEN.includes(category));
          const d = await env.ctx.policy.authorize({ userId: r.id, role: r.role }, 'read', env.ids.somsri, category);
          rows.push(`${r.name} ${category} ${state} → ${d.allowed}`);
          expect(d.allowed, `${r.name} / ${category} / ${state}`).toBe(expected);
          const route = READ_ROUTES[category];
          if (route) {
            const res = await client.get(`/seniors/${env.ids.somsri}/${route}`);
            expect(res.statusCode, `HTTP ${r.name} / ${category} / ${state}`).toBe(expected ? 200 : 404);
            if (!expected) expect(json(res).error.code).toBe('NOT_FOUND'); // revoke looks exactly like "does not exist"
          }
        }
        await setGrant(r.id, category, 'none');
      }
    }
    expect(rows.length).toBe(5 * SHARE_CATEGORIES.length * 4);
  });

  it('the senior always reads own data; another senior never does', async () => {
    for (const c of SHARE_CATEGORIES) {
      expect((await env.ctx.policy.authorize({ userId: env.ids.somsri, role: 'senior' }, 'read', env.ids.somsri, c)).allowed).toBe(true);
    }
    const other = await createUser(env.db, 'other-senior@test.fg', 'senior');
    expect((await env.ctx.policy.authorize({ userId: other.id, role: 'senior' }, 'read', env.ids.somsri, 'checkins')).allowed).toBe(false);
  });

  it('only the senior writes / manages grants (grantees cannot, even with an active grant)', async () => {
    await setGrant(env.ids.anan, 'checkins', 'active');
    expect((await env.ctx.policy.authorize({ userId: env.ids.anan, role: 'family' }, 'write', env.ids.somsri, 'checkins')).allowed).toBe(false);
    expect((await env.ctx.policy.authorize({ userId: env.ids.anan, role: 'family' }, 'manage_grants', env.ids.somsri, 'checkins')).allowed).toBe(false);
    const nok = await env.as('nok');
    const r = await nok.post('/me/grants', { granteeUserId: env.ids.anan, category: 'help_requests' });
    expect(r.statusCode).toBe(403);
    expect((await nok.post('/me/invitations', { inviteeName: 'x', relationship: 'y', role: 'family' })).statusCode).toBe(403);
    expect((await nok.post('/me/checkins', { mood: 'happy' })).statusCode).toBe(403);
    await setGrant(env.ids.anan, 'checkins', 'none');
  });

  it('caregivers can never be granted CAREGIVER_FORBIDDEN categories (403)', async () => {
    const somsri = await env.as('somsri');
    for (const category of CAREGIVER_FORBIDDEN) {
      const r = await somsri.post('/me/grants', { granteeUserId: env.ids.pim, category, password: 'Demo-Senior-2026' });
      expect(r.statusCode).toBe(403);
      expect(json(r).error.code).toBe('CAREGIVER_FORBIDDEN');
    }
    const ok = await somsri.post('/me/grants', { granteeUserId: env.ids.pim, category: 'contacts' });
    expect(ok.statusCode).toBe(200);
  });

  it('admin can never read check-ins, notes, scam text or pauses; overview is counts only', async () => {
    const admin = await env.as('admin');
    for (const route of ['checkins', 'scam-checks', 'guardian-pause', 'contacts']) {
      expect((await admin.get(`/seniors/${env.ids.somsri}/${route}`)).statusCode).toBe(404);
    }
    expect((await admin.get(`/alerts/${env.helpAlertId}`)).statusCode).toBe(404);
    expect((await admin.get('/me/checkins')).statusCode).toBe(403);
    expect((await admin.get('/me/scam-checks')).statusCode).toBe(403);
    expect((await admin.get('/dashboard')).statusCode).toBe(403);
    const o = await admin.get('/admin/overview');
    expect(o.statusCode).toBe(200);
    const body = o.body;
    expect(body).not.toContain('SYNTHETIC]'); // no scam text
    expect(body).not.toContain('synthetic)'); // no check-in notes
    expect(json(o).users.senior).toBeGreaterThanOrEqual(1);
    expect(Object.keys(json(o)).sort()).toEqual(['directoryUnverified', 'failedDeliveriesLast24h', 'families', 'generatedAt', 'notifications', 'users']);
    expect((await (await env.as('nok')).get('/admin/overview')).statusCode).toBe(403);
  });

  it('a grant expires: default +90d, max +365d, past rejected', async () => {
    const somsri = await env.as('somsri');
    const r = await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'help_requests' });
    expect(r.statusCode).toBe(200);
    const days = (Date.parse(json(r).expiresAt) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(89.9); expect(days).toBeLessThan(90.1);
    const tooFar = await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'contacts', expiresAt: new Date(Date.now() + 400 * DAY).toISOString() });
    expect(tooFar.statusCode).toBe(400);
    const past = await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'contacts', expiresAt: new Date(Date.now() - DAY).toISOString() });
    expect(past.statusCode).toBe(400);
    const dup = await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'help_requests' });
    expect(dup.statusCode).toBe(409);
  });

  it('sensitive grants need step-up password (and it rotates the session)', async () => {
    const somsri = await env.as('somsri');
    const before = somsri.cookie;
    expect((await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'checkins' })).statusCode).toBe(401);
    const bad = await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'checkins', password: 'wrong' });
    expect(bad.statusCode).toBe(401);
    expect(json(bad).error.code).toBe('step_up_failed');
    expect((await somsri.get('/auth/me')).statusCode).toBe(200); // session survives a failed step-up
    const ok = await somsri.post('/me/grants', { granteeUserId: env.ids.anan, category: 'checkins', password: 'Demo-Senior-2026' });
    expect(ok.statusCode).toBe(200);
    expect(somsri.cookie).not.toBe(before);
    expect((await somsri.get('/auth/me')).statusCode).toBe(200);
  });

  it('grants are listed: senior sees history; grantee sees only own ACTIVE grants without revokedAt', async () => {
    await env.reseed();
    const somsri = await env.as('somsri');
    const all = json<any[]>(await somsri.get('/me/grants'));
    const nokCheckins = all.find((g) => g.granteeUserId === env.ids.nok && g.category === 'checkins')!;
    await somsri.del(`/me/grants/${nokCheckins.id}`);
    const after = json<any[]>(await somsri.get('/me/grants'));
    expect(after.find((g) => g.id === nokCheckins.id).revokedAt).toBeTruthy();
    const nokGrants = json<any[]>(await (await env.as('nok')).get('/me/grants'));
    expect(nokGrants.map((g) => g.category).sort()).toEqual(['contacts', 'help_requests', 'scam_checks', 'transfer_pauses']);
    for (const g of nokGrants) { expect(g).not.toHaveProperty('revokedAt'); expect(g.granteeUserId).toBe(env.ids.nok); }
    expect(json<any[]>(await (await env.as('anan')).get('/me/grants'))).toEqual([]);
  });

  it('every successful read of shared data writes an access-log row the senior can see', async () => {
    await env.reseed();
    const nok = await env.as('nok');
    await nok.get(`/seniors/${env.ids.somsri}/checkins`);
    await nok.get(`/seniors/${env.ids.somsri}/contacts`);
    const rows = await env.db.select().from(accessLogs).where(eq(accessLogs.viewerId, env.ids.nok));
    expect(rows.map((r) => r.category).sort()).toEqual(['checkins', 'contacts']);
    // denied reads do not log
    await (await env.as('anan')).get(`/seniors/${env.ids.somsri}/checkins`);
    expect(await env.db.select().from(accessLogs).where(eq(accessLogs.viewerId, env.ids.anan))).toHaveLength(0);
    const log = json<any[]>(await (await env.as('somsri')).get('/me/access-log'));
    expect(log.map((l) => l.viewerName)).toContain('นก (Nok)');
    expect((await nok.get('/me/access-log')).statusCode).toBe(403);
    void users;
  });
});
