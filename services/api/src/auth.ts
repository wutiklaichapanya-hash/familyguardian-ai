// First-party auth (ADR-004): Argon2id passwords + server-side sessions (SHA-256 token hash, idle + absolute expiry).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db/client';
import { sessions, users } from './db/schema';
import type { AppConfig } from './config';
import { HttpError } from './errors';

/** Dev/test cookie name. In production the `__Host-` prefix is used (SR-11): Secure, Path=/, no Domain. */
export const SESSION_COOKIE = 'fg_session';
export const SESSION_COOKIE_PROD = '__Host-fg_session';
export const sessionCookieName = (cfg: Pick<AppConfig, 'nodeEnv'>) => (cfg.nodeEnv === 'production' ? SESSION_COOKIE_PROD : SESSION_COOKIE);

// Argon2id is the library default algorithm; parameters follow OWASP minimums (19 MiB, t=2).
export const hashPassword = (pw: string) => hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = async (stored: string, pw: string) => {
  try { return await verify(stored, pw); } catch { return false; }
};
// Equalises timing for unknown emails (no account enumeration).
let dummyHash: Promise<string> | null = null;
export const dummyVerify = async (pw: string) => {
  dummyHash ??= hashPassword('fg-dummy-password-for-timing');
  await verifyPassword(await dummyHash, pw);
  return false;
};

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const safeEqualHex = (a: string, b: string) => {
  const ab = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};
/** base64url random token; default 256 bits. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export async function createSession(db: Db, userId: string, cfg: Pick<AppConfig, 'sessionTtlDays'>, userAgent = ''): Promise<{ token: string; expiresAt: Date; id: string }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + cfg.sessionTtlDays * 86_400_000);
  const [row] = await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt, userAgent: userAgent.slice(0, 200) }).returning({ id: sessions.id });
  return { token, expiresAt, id: row!.id };
}

/** Valid = not revoked, before absolute expiry, and used within the idle window. */
export async function resolveSession(db: Db, token: string | undefined, idleHours: number) {
  if (!token || token.length > 200) return null;
  const now = new Date();
  const [row] = await db.select({ sessionId: sessions.id, lastSeenAt: sessions.lastSeenAt, user: users })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now), isNull(sessions.revokedAt), isNull(users.deletedAt),
      gt(sessions.lastSeenAt, new Date(now.getTime() - idleHours * 3_600_000)),
    ))
    .limit(1);
  if (!row) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.sessionId));
  }
  return row;
}

export async function destroySession(db: Db, token: string | undefined) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function listSessions(db: Db, userId: string) {
  return db.select().from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).orderBy(desc(sessions.lastSeenAt));
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, cfg: Pick<AppConfig, 'nodeEnv'>) {
  // `__Host-` cookies must be Secure, Path=/ and carry no Domain attribute.
  reply.setCookie(sessionCookieName(cfg), token, { httpOnly: true, sameSite: 'lax', secure: cfg.nodeEnv === 'production', path: '/', expires: expiresAt });
}

/**
 * Step-up (SR-11): the body must carry the current password. On success the session token is rotated.
 * Failure → 401 code 'step_up_failed' (the session itself stays valid).
 */
export async function requireStepUp(db: Db, cfg: AppConfig, req: FastifyRequest, reply: FastifyReply, password: string | undefined): Promise<void> {
  const u = req.user;
  if (!u || !password || !(await verifyPassword(u.passwordHash, password))) {
    throw new HttpError(401, 'step_up_failed', 'Please re-enter your password to confirm');
  }
  const old = req.cookies[sessionCookieName(cfg)];
  const s = await createSession(db, u.id, cfg, String(req.headers['user-agent'] ?? ''));
  await destroySession(db, old);
  setSessionCookie(reply, s.token, s.expiresAt, cfg);
  req.sessionId = s.id;
}

/** Progressive delay on failed logins keyed on account + IP (SR-15): no hard lockout. */
export class LoginThrottle {
  private failures = new Map<string, { n: number; at: number }>();
  constructor(private baseMs: number, private maxMs = 8000) {}
  delayFor(key: string): number {
    const f = this.failures.get(key);
    if (!f || Date.now() - f.at > 15 * 60_000) return 0;
    return Math.min(this.baseMs * 2 ** (f.n - 1), this.maxMs);
  }
  fail(key: string) {
    const f = this.failures.get(key);
    this.failures.set(key, { n: (f && Date.now() - f.at <= 15 * 60_000 ? f.n : 0) + 1, at: Date.now() });
    if (this.failures.size > 10_000) this.failures.clear();
  }
  success(key: string) { this.failures.delete(key); }
}
