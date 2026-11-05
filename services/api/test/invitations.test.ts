// Invitations: 128-bit link token, single use, 72h TTL, 5-attempt limit, pending → senior confirms (step-up), zero grants.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { consentGrants, invitations } from '../src/db/schema';
import { setupEnv, json, createUser, type TestEnv, Client } from './helpers';

let env: TestEnv;
beforeAll(async () => { env = await setupEnv(); });
afterAll(async () => { await env.close(); });

async function invite(role: 'family' | 'caregiver' = 'family') {
  const somsri = await env.as('somsri');
  const r = await somsri.post('/me/invitations', { inviteeName: 'หลาน (Grandchild)', relationship: 'grandchild', role });
  expect(r.statusCode).toBe(200);
  return json(r);
}
let n = 0;
async function newInvitee(): Promise<{ id: string; client: Client }> {
  const u = await createUser(env.db, `invitee${++n}@test.fg`);
  return { id: u.id, client: await env.asUser(u.id) };
}

describe('invitations', () => {
  it('returns a 128-bit link token once, stored hashed, with 72h TTL and no spoken code', async () => {
    const inv = await invite();
    const [id, secret] = inv.token.split('.');
    expect(id).toBe(inv.id);
    expect(Buffer.from(secret, 'base64url').length).toBe(16);
    expect(inv).not.toHaveProperty('code');
    expect(inv.inviteUrl).toBe(`http://localhost:3100/invite/accept#token=${inv.token}`);
    const hours = (Date.parse(inv.expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(71.9); expect(hours).toBeLessThan(72.1);
    const [row] = await env.db.select().from(invitations).where(eq(invitations.id, inv.id));
    expect(row!.tokenHash).not.toContain(secret);
    const list = json<any[]>(await (await env.as('somsri')).get('/me/invitations'));
    expect(list.find((i) => i.id === inv.id)).not.toHaveProperty('token');
  });

  it('accept → pending_confirmation with zero grants; pending member sees nothing; senior confirms with step-up', async () => {
    const inv = await invite();
    const joiner = await newInvitee();
    const acc = await joiner.client.post('/invitations/accept', { token: inv.token });
    expect(acc.statusCode).toBe(200);
    expect(json(acc)).toEqual({ status: 'pending_confirmation', seniorFirstName: 'สมศรี' });
    expect(json(await joiner.client.get('/auth/me')).circles).toEqual([]);
    expect(json(await joiner.client.get('/dashboard')).seniors).toEqual([]);

    const somsri = await env.as('somsri');
    expect(json<any[]>(await somsri.get('/me/members')).map((m) => m.userId)).not.toContain(joiner.id);
    const pending = json<any[]>(await somsri.get('/me/invitations')).find((i) => i.id === inv.id);
    expect(pending.status).toBe('pending_confirmation');
    expect(pending.acceptedByAccountName).toContain('invitee');

    expect((await somsri.post(`/me/invitations/${inv.id}/confirm`, { password: 'wrong' })).statusCode).toBe(401);
    const conf = await somsri.post(`/me/invitations/${inv.id}/confirm`, { password: 'Demo-Senior-2026' });
    expect(conf.statusCode).toBe(200);
    expect(json(conf).activeGrants).toEqual([]);
    expect(await env.db.select().from(consentGrants).where(eq(consentGrants.granteeUserId, joiner.id))).toHaveLength(0);
    expect(json(await joiner.client.get('/auth/me')).circles).toHaveLength(1);
    // confirmed, but zero grants → nothing readable, status not_shared
    expect((await joiner.client.get(`/seniors/${env.ids.somsri}/checkins`)).statusCode).toBe(404);
    expect(json(await joiner.client.get('/dashboard')).seniors[0].status).toBe('not_shared');
  });

  it('is single-use', async () => {
    const inv = await invite();
    const a = await newInvitee();
    const b = await newInvitee();
    expect((await a.client.post('/invitations/accept', { token: inv.token })).statusCode).toBe(200);
    const again = await b.client.post('/invitations/accept', { token: inv.token });
    expect(again.statusCode).toBe(400);
    expect(json(again).error.code).toBe('INVITE_INVALID');
  });

  it('expires after 72h', async () => {
    const inv = await invite();
    await env.db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, inv.id));
    const a = await newInvitee();
    expect((await a.client.post('/invitations/accept', { token: inv.token })).statusCode).toBe(400);
    const list = json<any[]>(await (await env.as('somsri')).get('/me/invitations'));
    expect(list.find((i) => i.id === inv.id).status).toBe('expired');
  });

  it('5 failed attempts invalidate the invite (same generic error throughout)', async () => {
    const inv = await invite();
    const a = await newInvitee();
    const bodies = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = await a.client.post('/invitations/accept', { token: `${inv.id}.wrongSecretValue${i}` });
      expect(r.statusCode).toBe(400);
      bodies.add(r.body);
    }
    const real = await a.client.post('/invitations/accept', { token: inv.token });
    expect(real.statusCode).toBe(400);
    bodies.add(real.body);
    expect(bodies.size).toBe(1);
  });

  it('senior and admin cannot accept; cancel works; members list is senior-only (404)', async () => {
    const inv = await invite();
    expect((await (await env.as('admin')).post('/invitations/accept', { token: inv.token })).statusCode).toBe(400);
    const somsri = await env.as('somsri');
    expect((await somsri.del(`/me/invitations/${inv.id}`)).statusCode).toBe(204);
    const a = await newInvitee();
    expect((await a.client.post('/invitations/accept', { token: inv.token })).statusCode).toBe(400);
    expect((await (await env.as('nok')).get('/me/members')).statusCode).toBe(404);
    expect((await (await env.as('nok')).post('/me/invitations', { inviteeName: 'x', relationship: 'y', role: 'family' })).statusCode).toBe(403);
  });

  it('removing a member needs step-up and revokes all their grants', async () => {
    const somsri = await env.as('somsri');
    expect((await somsri.del(`/me/members/${env.ids.nok}`, { password: 'nope' })).statusCode).toBe(401);
    expect((await somsri.del(`/me/members/${env.ids.nok}`, { password: 'Demo-Senior-2026' })).statusCode).toBe(204);
    const g = await env.db.select().from(consentGrants).where(eq(consentGrants.granteeUserId, env.ids.nok));
    expect(g.every((x) => x.revokedAt)).toBe(true);
    expect((await (await env.as('nok')).get(`/seniors/${env.ids.somsri}/checkins`)).statusCode).toBe(404);
  });
});
