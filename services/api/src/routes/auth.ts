import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { SessionDTO } from '@fg/shared';
import type { Ctx } from '../app';
import { requireUser } from '../app';
import { sessions, users } from '../db/schema';
import {
  createSession, destroySession, dummyVerify, listSessions, LoginThrottle, SESSION_COOKIE, setSessionCookie, verifyPassword,
} from '../auth';
import { recordAudit } from '../audit';
import { HttpError, notFound } from '../errors';
import { doc, idParam, loginReq } from '../validation';
import { meRes } from '../circles';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config } = ctx;
  const throttle = new LoginThrottle(config.loginDelayBaseMs);
  const emailOf = (body: unknown) => {
    const e = (body as { email?: unknown } | undefined)?.email;
    return typeof e === 'string' ? e.trim().toLowerCase() : '';
  };

  app.post('/auth/login', {
    schema: { tags: ['auth'], summary: 'Sign in (sets httpOnly fg_session cookie; requires x-fg-csrf)', body: doc(loginReq) },
    config: {
      rateLimit: { max: config.loginRateLimitMax, timeWindow: '1 minute', hook: 'preHandler', keyGenerator: (req) => `login|${req.ip}|${emailOf(req.body)}` },
    },
  }, async (req, reply) => {
    const body = loginReq.parse(req.body);
    const key = `${req.ip}|${body.email}`;
    const delay = throttle.delayFor(key);
    if (delay > 0) await sleep(delay); // progressive delay, never a hard lockout (SR-15)
    const [u] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    const ok = u && !u.deletedAt ? await verifyPassword(u.passwordHash, body.password) : await dummyVerify(body.password);
    if (!u || !ok) {
      throttle.fail(key);
      await recordAudit(db, { actorId: u?.id ?? null, action: 'auth.login_failed' });
      // Same response whether or not the account exists.
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    throttle.success(key);
    // Rotate: any session presented with this request is discarded and a fresh token is issued.
    await destroySession(db, req.cookies[SESSION_COOKIE]);
    const s = await createSession(db, u.id, config, String(req.headers['user-agent'] ?? ''));
    setSessionCookie(reply, s.token, s.expiresAt, config);
    await recordAudit(db, { actorId: u.id, seniorId: u.role === 'senior' ? u.id : null, action: 'auth.login' });
    return meRes(db, u);
  });

  app.post('/auth/logout', { schema: { tags: ['auth'], summary: 'Sign out (Clear-Site-Data)' } }, async (req, reply) => {
    await destroySession(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.header('clear-site-data', '"cache", "storage"');
    if (req.user) await recordAudit(db, { actorId: req.user.id, action: 'auth.logout' });
    return reply.status(204).send();
  });

  app.get('/auth/me', { schema: { tags: ['auth'], summary: 'Current user and circles' } }, async (req) => meRes(db, requireUser(req)));

  app.get('/auth/sessions', { schema: { tags: ['auth'], summary: 'My signed-in devices' } }, async (req): Promise<SessionDTO[]> => {
    const u = requireUser(req);
    const rows = await listSessions(db, u.id);
    return rows.map((s) => ({ id: s.id, current: s.id === req.sessionId, userAgent: s.userAgent, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }));
  });

  app.delete('/auth/sessions/:id', { schema: { tags: ['auth'], summary: 'Sign out a device' } }, async (req, reply) => {
    const u = requireUser(req);
    const { id } = idParam.parse(req.params);
    const res = await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, u.id))).returning({ id: sessions.id });
    if (res.length === 0) throw notFound();
    await recordAudit(db, { actorId: u.id, action: 'auth.session_revoked', targetType: 'session', targetId: id });
    if (id === req.sessionId) reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });
}
