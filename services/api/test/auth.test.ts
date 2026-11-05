import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { sessions, users } from '../src/db/schema';
import { setupEnv, json, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => { env = await setupEnv(); });
afterAll(async () => { await env.close(); });

const login = (email: string, password: string, headers: Record<string, string> = { 'x-fg-csrf': '1' }) =>
  env.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers, payload: { email, password } });

describe('auth', () => {
  it('health endpoint', async () => {
    const r = await env.app.inject({ method: 'GET', url: '/api/health' });
    expect(r.statusCode).toBe(200);
    expect(json(r).status).toBe('ok');
  });

  it('stores Argon2id hashes', async () => {
    const [u] = await env.db.select().from(users).where(eq(users.email, 'somsri@demo.fg'));
    expect(u!.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('login sets an httpOnly SameSite=Lax session cookie and returns MeRes', async () => {
    const r = await login('somsri@demo.fg', 'Demo-Senior-2026');
    expect(r.statusCode).toBe(200);
    const c = r.cookies.find((x) => x.name === 'fg_session')!;
    expect(c.httpOnly).toBe(true);
    expect(String(c.sameSite).toLowerCase()).toBe('lax');
    expect(c.secure).toBeFalsy(); // NODE_ENV != production
    const body = json(r);
    expect(body.user.email).toBe('somsri@demo.fg');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.circles).toHaveLength(1);
    // session stored hashed, never the raw token
    const rows = await env.db.select().from(sessions).where(sql`${sessions.tokenHash} = ${c.value}`);
    expect(rows).toHaveLength(0);
  });

  it('wrong password and unknown email give the identical response (no enumeration)', async () => {
    const a = await login('nok@demo.fg', 'wrong-password');
    const b = await login('nobody@demo.fg', 'wrong-password');
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.body).toBe(b.body);
  });

  it('CSRF header is required on mutations, including login', async () => {
    const r = await login('somsri@demo.fg', 'Demo-Senior-2026', {});
    expect(r.statusCode).toBe(403);
    expect(json(r).error.code).toBe('CSRF_REQUIRED');
    const somsri = await env.as('somsri');
    const noCsrf = await somsri.post('/me/checkins', { mood: 'happy' }, { 'x-fg-csrf': '' });
    expect(noCsrf.statusCode).toBe(403);
    const ok = await somsri.post('/me/checkins', { mood: 'happy' });
    expect(ok.statusCode).toBe(200);
  });

  it('login is rate limited per IP+email (5/min) → 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await login('anan@demo.fg', `bad-${i}`)).statusCode);
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[5]).toBe(429);
    // a different email from the same IP is not blocked by that key
    expect((await login('pim@demo.fg', 'Demo-Care-2026')).statusCode).toBe(200);
  });

  it('rotates the token on login (old presented session is discarded)', async () => {
    const c = await env.as('nok');
    const old = c.cookie;
    const r = await env.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'x-fg-csrf': '1', cookie: `fg_session=${old}` }, payload: { email: 'nok@demo.fg', password: 'Demo-Family-2026' } });
    expect(r.statusCode).toBe(200);
    const fresh = r.cookies.find((x) => x.name === 'fg_session')!.value;
    expect(fresh).not.toBe(old);
    expect((await c.get('/auth/me')).statusCode).toBe(401);
  });

  it('me requires a session; logout clears it with Clear-Site-Data', async () => {
    expect((await env.anon().get('/auth/me')).statusCode).toBe(401);
    const c = await env.as('nok');
    expect((await c.get('/auth/me')).statusCode).toBe(200);
    const token = c.cookie;
    const out = await c.post('/auth/logout');
    expect(out.statusCode).toBe(204);
    expect(out.headers['clear-site-data']).toContain('cache');
    c.cookie = token;
    expect((await c.get('/auth/me')).statusCode).toBe(401);
  });

  it('idle timeout (12h) and absolute expiry end the session', async () => {
    const c = await env.as('anan');
    expect((await c.get('/auth/me')).statusCode).toBe(200);
    await env.db.update(sessions).set({ lastSeenAt: new Date(Date.now() - 13 * 3_600_000) }).where(eq(sessions.userId, env.ids.anan));
    expect((await c.get('/auth/me')).statusCode).toBe(401);
    const d = await env.as('anan');
    await env.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, env.ids.anan));
    expect((await d.get('/auth/me')).statusCode).toBe(401);
  });

  it('lists and revokes own sessions', async () => {
    const a = await env.as('pim');
    const b = await env.as('pim');
    const list = json<any[]>(await a.get('/auth/sessions'));
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    const other = list.find((s) => !s.current)!;
    expect((await a.del(`/auth/sessions/${other.id}`)).statusCode).toBe(204);
    // someone else's session id → 404
    const nok = await env.as('nok');
    const nokSessions = json<any[]>(await nok.get('/auth/sessions'));
    expect((await a.del(`/auth/sessions/${nokSessions[0].id}`)).statusCode).toBe(404);
    void b;
  });

  it('API responses are no-store and carry helmet headers', async () => {
    const c = await env.as('somsri');
    const r = await c.get('/auth/me');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('OpenAPI docs are served', async () => {
    const r = await env.app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(r.statusCode).toBe(200);
    const spec = json(r);
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths)).toContain('/api/v1/dashboard');
  });

  it('CORS allows only WEB_ORIGIN', async () => {
    const ok = await env.app.inject({ method: 'OPTIONS', url: '/api/v1/auth/me', headers: { origin: 'http://localhost:3100', 'access-control-request-method': 'GET' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3100');
    const bad = await env.app.inject({ method: 'OPTIONS', url: '/api/v1/auth/me', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('audit_events is append-only at the DB level', async () => {
    await expect(env.db.execute(sql`update audit_events set action = 'x'`)).rejects.toThrow();
    await expect(env.db.execute(sql`delete from audit_events`)).rejects.toThrow();
  });
});
