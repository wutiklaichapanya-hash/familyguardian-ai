import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import { sql } from 'drizzle-orm';
import type { Role } from '@fg/shared';
import { loadConfig, type AppConfig } from './config';
import { createDb, type Db } from './db/client';
import { Policy } from './policy';
import { NotificationEngine } from './notifications/engine';
import { SimulatedAdapter } from './notifications/adapter';
import { PgBossQueue, type JobQueue } from './notifications/queue';
import { resolveSession, SESSION_COOKIE } from './auth';
import { HttpError, forbidden, unauthorized } from './errors';
import type { users } from './db/schema';
import authRoutes from './routes/auth';
import seniorRoutes from './routes/senior';
import circleRoutes from './routes/circle';
import viewerRoutes from './routes/viewer';
import miscRoutes from './routes/misc';
import billingRoutes from './routes/billing';

export type UserRow = typeof users.$inferSelect;

export interface Ctx {
  db: Db;
  config: AppConfig;
  policy: Policy;
  engine: NotificationEngine;
  queue: JobQueue;
  adapter: SimulatedAdapter;
}

declare module 'fastify' {
  interface FastifyRequest { user: UserRow | null; sessionId: string | null }
}

export const API_PREFIX = '/api/v1';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Mutations exempt from the custom CSRF header (server-to-server, HMAC-verified). */
// Login is NOT exempt (login CSRF).
const CSRF_EXEMPT = new Set([`${API_PREFIX}/webhooks/payments/sandbox`]);

export const LOG_REDACT_PATHS = [
  'req.headers.cookie', 'req.headers.authorization', 'req.headers["x-fg-signature"]',
  'res.headers["set-cookie"]', 'req.body', 'body',
  '*.password', '*.phone', '*.note', '*.text', '*.message', '*.recipientNote', '*.token', '*.code',
];

export interface BuildOptions {
  config?: Partial<AppConfig>;
  db?: Db;
  queue?: JobQueue;
  adapter?: SimulatedAdapter;
  logger?: boolean;
  /** Start notification workers (default true). */
  startWorkers?: boolean;
}

export async function buildApp(opts: BuildOptions = {}): Promise<{ app: FastifyInstance; ctx: Ctx; close: () => Promise<void> }> {
  const config = loadConfig(process.env, opts.config);
  const owned = opts.db ? null : createDb(config.databaseUrl);
  const db = opts.db ?? owned!.db;

  const app = Fastify({
    logger: opts.logger === false ? false : {
      level: config.logLevel,
      redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
    },
    bodyLimit: 64 * 1024,
    trustProxy: false,
    ajv: { customOptions: { strict: false } },
  });
  // Validation is done with zod in handlers; JSON schemas on routes are for OpenAPI docs only.
  app.setValidatorCompiler(() => (data) => ({ value: data }));

  const queue = opts.queue ?? new PgBossQueue(config.databaseUrl, app.log);
  const adapter = opts.adapter ?? new SimulatedAdapter(config.notifyForceFail);
  const policy = new Policy(db);
  const engine = new NotificationEngine(db, policy, queue, adapter, config, app.log);
  const ctx: Ctx = { db, config, policy, engine, queue, adapter };

  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') } });
    }
    const e = err as { statusCode?: number; code?: string; message?: string };
    const status = e.statusCode && e.statusCode >= 400 && e.statusCode < 500 ? e.statusCode : 500;
    if (status === 500) req.log.error({ err }, 'unhandled error');
    return reply.status(status).send({ error: { code: status === 500 ? 'INTERNAL' : (e.code ?? 'BAD_REQUEST'), message: status === 500 ? 'Something went wrong' : (e.message ?? 'Bad request') } });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } }));

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(cors, { origin: [config.webOrigin], credentials: true, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['content-type', 'x-fg-csrf'] });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitGlobalMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, c) => new HttpError(c.statusCode === 403 ? 403 : 429, 'RATE_LIMITED', `Too many requests. Try again in ${c.after}.`),
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'FamilyGuardian AI API', version: '0.1.0', description: 'P0 API. All data is SYNTHETIC in the demo. Mutations require header `x-fg-csrf: 1`.' },
      components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE } } },
      security: [{ session: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs', staticCSP: true });

  // Session + CSRF
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith(API_PREFIX)) return;
    const path = req.url.split('?')[0]!;
    if (!SAFE_METHODS.has(req.method) && !CSRF_EXEMPT.has(path) && req.headers['x-fg-csrf'] !== '1') {
      throw forbidden('CSRF_REQUIRED', 'Missing x-fg-csrf header');
    }
    const row = await resolveSession(db, req.cookies[SESSION_COOKIE], config.sessionIdleHours);
    req.user = row?.user ?? null;
    req.sessionId = row?.sessionId ?? null;
  });
  // SR-14: never cache API responses (shared devices).
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith(API_PREFIX)) reply.header('cache-control', 'no-store');
  });

  app.get('/api/health', { schema: { tags: ['system'], summary: 'Health check' }, config: { rateLimit: false } }, async () => {
    let dbOk = false;
    try { await db.execute(sql`select 1`); dbOk = true; } catch { /* reported below */ }
    return { status: dbOk ? 'ok' : 'degraded', db: dbOk ? 'ok' : 'down', time: new Date().toISOString() };
  });

  await app.register(async (api) => {
    await authRoutes(api, ctx);
    await seniorRoutes(api, ctx);
    await circleRoutes(api, ctx);
    await viewerRoutes(api, ctx);
    await miscRoutes(api, ctx);
    await billingRoutes(api, ctx);
  }, { prefix: API_PREFIX });

  if (opts.startWorkers !== false) await engine.startWorkers();

  const close = async () => {
    await app.close();
    await queue.stop();
    if (owned) await owned.close();
  };
  return { app, ctx, close };
}

// ---- request helpers ----
export function requireUser(req: FastifyRequest): UserRow {
  if (!req.user) throw unauthorized();
  return req.user;
}
export function requireRole(req: FastifyRequest, ...roles: Role[]): UserRow {
  const u = requireUser(req);
  if (!roles.includes(u.role)) throw forbidden('ROLE_FORBIDDEN', 'Not available for this account type');
  return u;
}
export const actorOf = (u: UserRow) => ({ userId: u.id, role: u.role });
