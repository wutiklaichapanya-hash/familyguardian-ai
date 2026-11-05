import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { RegisterRes, SessionDTO } from '@fg/shared';
import type { Ctx } from '../app';
import { requireUser } from '../app';
import { families, sessions, users } from '../db/schema';
import {
  createSession, destroySession, dummyVerify, hashPassword, listSessions, LoginThrottle, sessionCookieName, setSessionCookie, verifyPassword,
} from '../auth';
import { recordAudit } from '../audit';
import { HttpError, badRequest, notFound } from '../errors';
import { doc, idParam, loginReq, registerReq } from '../validation';
import { passwordProblems } from '../password';
import { meRes } from '../circles';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config } = ctx;
  const throttle = new LoginThrottle(config.loginDelayBaseMs);
  const SESSION_COOKIE = sessionCookieName(config);
  const clearOpts = { path: '/', secure: config.nodeEnv === 'production' }; // __Host- cookies need Secure to be cleared
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

  // SR-24 (v0.3, DEMO): self-registration. Same 202 whether or not the email exists (no enumeration); never signs in.
  // A password hash is computed on BOTH paths so timing is similar. Password reset is out of scope (no email provider).
  const REGISTER_RES: RegisterRes = {
    status: 'accepted',
    message: {
      th: 'ถ้าอีเมลนี้ยังไม่เคยใช้ บัญชีถูกสร้างแล้ว ลองเข้าสู่ระบบได้เลย',
      en: 'If this email was not already registered, the account has been created. You can try signing in now.',
    },
  };
  app.post('/auth/register', {
    schema: { tags: ['auth'], summary: 'Create a senior or family account (demo; same 202 whether or not the email exists)', body: doc(registerReq), security: [] },
    config: { rateLimit: { max: config.registerRateLimitMax, timeWindow: '1 hour', keyGenerator: (req) => `register|${req.ip}` } },
  }, async (req, reply) => {
    const b = registerReq.parse(req.body);
    const problems = passwordProblems(b.password, b.email);
    if (problems.length) throw badRequest('weak_password', `Password: ${problems.join('; ')}`);
    const passwordHash = await hashPassword(b.password);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, b.email)).limit(1);
    if (existing) {
      await recordAudit(db, { action: 'auth.register_duplicate' }); // no ids, no email
      return reply.status(202).send(REGISTER_RES);
    }
    try {
      await db.transaction(async (tx) => {
        const [u] = await tx.insert(users).values({
          email: b.email, passwordHash, displayName: b.displayName, role: b.role, locale: b.locale ?? 'th',
          politeParticle: b.politeParticle ?? 'ka', phone: b.role === 'senior' ? (b.phone ?? null) : null, isSynthetic: false,
        }).returning({ id: users.id });
        // A senior owns exactly one family (the [senior] checks are ownership-based).
        if (b.role === 'senior') await tx.insert(families).values({ name: `${b.displayName}'s family`, seniorId: u!.id });
        await recordAudit(tx, { actorId: u!.id, seniorId: b.role === 'senior' ? u!.id : null, action: 'auth.registered', meta: { role: b.role } });
      });
    } catch (e) {
      // Concurrent registration of the same email: unique violation → same response.
      if ((e as { code?: string; cause?: { code?: string } }).code !== '23505' && (e as { cause?: { code?: string } }).cause?.code !== '23505') throw e;
    }
    return reply.status(202).send(REGISTER_RES);
  });

  app.post('/auth/logout', { schema: { tags: ['auth'], summary: 'Sign out (Clear-Site-Data)' } }, async (req, reply) => {
    await destroySession(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, clearOpts);
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
    if (id === req.sessionId) reply.clearCookie(SESSION_COOKIE, clearOpts);
    return reply.status(204).send();
  });
}
