import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp, type Ctx } from '../src/app';
import { createDb, type Db } from '../src/db/client';
import { seedDemo, DEMO_USERS } from '../src/db/seed';
import { createSession, SESSION_COOKIE } from '../src/auth';
import { users } from '../src/db/schema';
import { ManualQueue, type JobQueue } from '../src/notifications/queue';
import { SimulatedAdapter } from '../src/notifications/adapter';
import type { AppConfig } from '../src/config';

export type DemoKey = keyof typeof DEMO_USERS;

export class Client {
  constructor(private app: FastifyInstance, public cookie: string | null) {}
  private async req(method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await this.app.inject({
      method, url: url.startsWith('/api') ? url : `/api/v1${url}`,
      headers: {
        ...(method !== 'GET' ? { 'x-fg-csrf': '1' } : {}),
        ...(this.cookie ? { cookie: `${SESSION_COOKIE}=${this.cookie}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { payload: body as object } : {}),
    });
    const set = res.cookies.find((c) => c.name === SESSION_COOKIE);
    if (set) this.cookie = set.value || null; // follow token rotation (login / step-up)
    return res;
  }
  get(url: string, headers?: Record<string, string>) { return this.req('GET', url, undefined, headers); }
  post(url: string, body: unknown = {}, headers?: Record<string, string>) { return this.req('POST', url, body, headers); }
  del(url: string, body?: unknown, headers?: Record<string, string>) { return this.req('DELETE', url, body, headers); }
}

export interface TestEnv {
  app: FastifyInstance; ctx: Ctx; db: Db; queue: ManualQueue; adapter: SimulatedAdapter;
  ids: Record<DemoKey, string>; familyId: string; scamCheckId: string; helpAlertId: string;
  as(key: DemoKey): Promise<Client>;
  asUser(userId: string): Promise<Client>;
  anon(): Client;
  reseed(): Promise<void>;
  close(): Promise<void>;
}

export async function setupEnv(opts: { config?: Partial<AppConfig>; queue?: JobQueue } = {}): Promise<TestEnv> {
  const { db, close: closeDb } = createDb(process.env.DATABASE_URL!, { max: 5 });
  const seeded = { ...(await seedDemo(db)) };
  const queue = new ManualQueue();
  const adapter = new SimulatedAdapter();
  const { app, ctx, close } = await buildApp({
    db, queue: opts.queue ?? queue, adapter, logger: false,
    config: { rateLimitGlobalMax: 100_000, inviteRateLimitMax: 1000, scamCheckRateLimitMax: 1000, helpRateLimitMax: 1000, loginDelayBaseMs: 1, notifyRetryBaseSeconds: 0, ...opts.config },
  });
  await app.ready();
  const env: TestEnv = {
    app, ctx, db, queue, adapter, ...seeded,
    async asUser(userId) {
      const s = await createSession(db, userId, { sessionTtlDays: 30 });
      return new Client(app, s.token);
    },
    async as(key) { return env.asUser(env.ids[key]); },
    anon: () => new Client(app, null),
    async reseed() {
      const r = await seedDemo(db);
      Object.assign(env, r);
      queue.jobs = [];
      adapter.forceFail = false; adapter.failRecipients.clear();
    },
    async close() { await close(); await closeDb(); },
  };
  return env;
}

export const json = <T = any>(r: LightMyRequestResponse): T => r.json() as T;

export async function createUser(db: Db, email: string, role: 'family' | 'caregiver' | 'senior' = 'family', password = 'Pw-For-Test-2026') {
  const { hashPassword } = await import('../src/auth');
  const [u] = await db.insert(users).values({ email, passwordHash: await hashPassword(password), displayName: `Test ${email}`, role, isSynthetic: true }).returning();
  return u!;
}
export async function userByEmail(db: Db, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return u!;
}
