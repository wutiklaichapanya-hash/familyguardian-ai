// End-to-end with the REAL pg-boss worker (in-process), as the server runs it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { notifications } from '../src/db/schema';
import { PgBossQueue } from '../src/notifications/queue';
import { setupEnv, json, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await setupEnv({ queue: new PgBossQueue(process.env.DATABASE_URL!, { error: () => {} }, 0.5) });
});
afterAll(async () => { await env.close(); });

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('pg-boss worker', () => {
  it('delivers a help request: queued → sent', async () => {
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    const rows = await waitFor(
      () => env.db.select().from(notifications).where(eq(notifications.alertId, alert.id)),
      (r) => r.length === 2 && r.every((n) => n.state === 'sent'),
    );
    expect(rows.map((n) => n.state)).toEqual(['sent', 'sent']);
  });
});
