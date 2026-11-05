// Notification engine: help lifecycle, retry/failure, cancelled_no_consent, revoke → contentUnavailable, follow-up, noRecipients.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { consentGrants, notifications } from '../src/db/schema';
import { JOB_DELIVER, JOB_FOLLOWUP } from '../src/notifications/queue';
import { setupEnv, json, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => { await env.reseed(); });
afterAll(async () => { await env.close(); });

const notifsFor = (alertId: string) => env.db.select().from(notifications).where(eq(notifications.alertId, alertId));
async function revoke(granteeKey: 'nok' | 'pim', category: string) {
  const somsri = await env.as('somsri');
  const g = json<any[]>(await somsri.get('/me/grants')).find((x) => x.granteeUserId === env.ids[granteeKey] && x.category === category && !x.revokedAt);
  expect((await somsri.del(`/me/grants/${g.id}`)).statusCode).toBe(200);
}

describe('help request lifecycle', () => {
  it('queued → sent → seen → acknowledged, delivered only to members holding help_requests', async () => {
    const somsri = await env.as('somsri');
    const res = await somsri.post('/me/help-requests', { message: 'private message text' });
    expect(res.statusCode).toBe(200);
    const alert = json(res);
    expect(alert.kind).toBe('user_requested_help');
    expect(alert.origin).toBe('user_requested');
    expect(alert.deliveries.map((d: any) => d.recipientId).sort()).toEqual([env.ids.nok, env.ids.pim].sort());
    expect(alert.deliveries.every((d: any) => d.state === 'queued')).toBe(true);
    expect(alert.noRecipients).toBeUndefined();

    expect(await env.queue.drain(JOB_DELIVER)).toBe(2);
    const sent = await notifsFor(alert.id);
    expect(sent.every((n) => n.state === 'sent' && n.attempts === 1)).toBe(true);
    // body stays minimal: no message content
    for (const n of sent) { expect(n.body).not.toContain('private message'); expect(n.title).not.toContain('private message'); }

    const nok = await env.as('nok');
    const list = json<any[]>(await nok.get('/notifications'));
    const mine = list.find((n) => n.alertId === alert.id)!;
    expect(mine.simulated).toBe(true);
    expect(mine.contentUnavailable).toBe(false);
    expect(JSON.stringify(list)).not.toContain('private message');
    const seen = json(await nok.post(`/notifications/${mine.id}/seen`));
    expect(seen.state).toBe('seen');

    // recipient view: only own delivery, never the message
    const view = await nok.get(`/alerts/${alert.id}`);
    expect(json(view).deliveries).toHaveLength(1);
    expect(json(view).deliveries[0].recipientId).toBe(env.ids.nok);
    expect(view.body).not.toContain('private message');

    const ack = json(await nok.post(`/alerts/${alert.id}/ack`));
    expect(ack.acknowledgedBy.userId).toBe(env.ids.nok);
    const after = await notifsFor(alert.id);
    expect(after.find((n) => n.recipientId === env.ids.nok)!.state).toBe('acknowledged');
    // the senior sees all deliveries and the ack
    const own = json<any[]>(await somsri.get('/me/alerts')).find((a) => a.id === alert.id);
    expect(own.deliveries).toHaveLength(2);
    expect(own.acknowledgedBy.name).toBe('นก (Nok)');
    expect(own.summary).toContain('private message text'); // own message shown back only to the senior
    const logs = json<any[]>(await somsri.get('/me/action-logs'));
    expect(logs.map((l) => l.kind)).toEqual(expect.arrayContaining(['help_request_sent', 'alert_acknowledged']));
    // follow-up after ack does nothing
    await env.queue.drain(JOB_FOLLOWUP);
    expect((await notifsFor(alert.id)).filter((n) => n.isFollowUp)).toHaveLength(0);
  });

  it('members without the help_requests grant cannot see or ack (404)', async () => {
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    const anan = await env.as('anan');
    expect((await anan.get(`/alerts/${alert.id}`)).statusCode).toBe(404);
    expect((await anan.post(`/alerts/${alert.id}/ack`)).statusCode).toBe(404);
    expect(json<any[]>(await anan.get('/alerts'))).toEqual([]);
  });

  it('delivery failure → retries with backoff → failed after 1 + 3 retries', async () => {
    env.adapter.forceFail = true;
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    await env.queue.runOnce(JOB_DELIVER);
    let ns = await notifsFor(alert.id);
    expect(ns.every((n) => n.state === 'queued' && n.attempts === 1 && n.lastError)).toBe(true);
    const retries = env.queue.pending(JOB_DELIVER);
    expect(retries).toHaveLength(2);
    await env.queue.drain(JOB_DELIVER);
    ns = await notifsFor(alert.id);
    expect(ns.every((n) => n.state === 'failed' && n.attempts === 4)).toBe(true);
    const admin = json(await (await env.as('admin')).get('/admin/overview'));
    expect(admin.failedDeliveriesLast24h).toBe(2);
  });

  it('backoff delays grow exponentially (config base)', async () => {
    await env.close();
    env = await setupEnv({ config: { notifyRetryBaseSeconds: 5 } });
    env.adapter.forceFail = true;
    await (await env.as('somsri')).post('/me/help-requests', {});
    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      await env.queue.runOnce(JOB_DELIVER);
      delays.push(env.queue.pending(JOB_DELIVER)[0]!.delaySeconds);
    }
    expect(delays).toEqual([5, 10, 20]);
  });

  it('transient failure then success → sent', async () => {
    env.adapter.failRecipients.add(env.ids.pim);
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    await env.queue.runOnce(JOB_DELIVER);
    env.adapter.failRecipients.clear();
    await env.queue.drain(JOB_DELIVER);
    const ns = await notifsFor(alert.id);
    expect(ns.find((n) => n.recipientId === env.ids.pim)).toMatchObject({ state: 'sent', attempts: 2 });
    expect(ns.find((n) => n.recipientId === env.ids.nok)).toMatchObject({ state: 'sent', attempts: 1 });
  });

  it('consent re-checked at delivery: revoke between queue and send → cancelled_no_consent', async () => {
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    await revoke('pim', 'help_requests');
    await env.queue.drain(JOB_DELIVER);
    const ns = await notifsFor(alert.id);
    expect(ns.find((n) => n.recipientId === env.ids.pim)!.state).toBe('cancelled_no_consent');
    expect(ns.find((n) => n.recipientId === env.ids.nok)!.state).toBe('sent');
    expect(json<any[]>(await (await env.as('pim')).get('/notifications')).find((n) => n.alertId === alert.id)).toBeUndefined();
  });

  it('revoke → next read 404 and existing notifications show contentUnavailable with generic text', async () => {
    const nok = await env.as('nok');
    expect((await nok.get(`/alerts/${env.helpAlertId}`)).statusCode).toBe(200);
    expect((await nok.get(`/seniors/${env.ids.somsri}/scam-checks`)).statusCode).toBe(200);
    await revoke('nok', 'help_requests');
    await revoke('nok', 'scam_checks');
    expect((await nok.get(`/alerts/${env.helpAlertId}`)).statusCode).toBe(404);
    expect((await nok.post(`/alerts/${env.helpAlertId}/ack`)).statusCode).toBe(404);
    expect((await nok.get(`/seniors/${env.ids.somsri}/scam-checks`)).statusCode).toBe(404);
    const rows = await env.db.select().from(notifications).where(eq(notifications.recipientId, env.ids.nok));
    expect(rows.every((n) => n.contentRevoked)).toBe(true);
    const list = json<any[]>(await nok.get('/notifications'));
    expect(list.length).toBeGreaterThan(0);
    for (const n of list) {
      expect(n.contentUnavailable).toBe(true);
      expect(n.alertId).toBeNull();
      expect(n.body).toBe('เนื้อหานี้ไม่ได้แชร์แล้ว');
    }
  });

  it('expiry produces exactly the same notification text as a revoke', async () => {
    await env.db.update(consentGrants).set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(consentGrants.granteeUserId, env.ids.nok), eq(consentGrants.category, 'help_requests')));
    const n = json<any[]>(await (await env.as('nok')).get('/notifications')).find((x) => x.title === 'การแจ้งเตือน' && x.contentUnavailable);
    expect(n.body).toBe('เนื้อหานี้ไม่ได้แชร์แล้ว');
  });

  it('no ack → follow-up to the next permitted contact, then the next, then stops', async () => {
    const alert = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    const fu = env.queue.pending(JOB_FOLLOWUP);
    expect(fu).toHaveLength(1);
    expect(fu[0]!.delaySeconds).toBe(10 * 60); // HELP_FOLLOWUP_MINUTES default 10
    await env.queue.drain(JOB_DELIVER);
    await env.queue.runOnce(JOB_FOLLOWUP);
    let follow = (await notifsFor(alert.id)).filter((n) => n.isFollowUp);
    expect(follow.map((n) => n.recipientId)).toEqual([env.ids.nok]); // joined first
    await env.queue.runOnce(JOB_FOLLOWUP);
    follow = (await notifsFor(alert.id)).filter((n) => n.isFollowUp);
    expect(follow.map((n) => n.recipientId)).toEqual([env.ids.nok, env.ids.pim]);
    await env.queue.runOnce(JOB_FOLLOWUP);
    expect((await notifsFor(alert.id)).filter((n) => n.isFollowUp)).toHaveLength(2);
    expect(env.queue.pending(JOB_FOLLOWUP)).toHaveLength(0);
    await env.queue.drain(JOB_DELIVER);
    expect((await notifsFor(alert.id)).every((n) => n.state === 'sent')).toBe(true);
  });

  it('no eligible recipients → deliveries [] and noRecipients true, nothing queued', async () => {
    await revoke('nok', 'help_requests');
    await revoke('pim', 'help_requests');
    const r = json(await (await env.as('somsri')).post('/me/help-requests', {}));
    expect(r.deliveries).toEqual([]);
    expect(r.noRecipients).toBe(true);
    expect(env.queue.pending()).toHaveLength(0);
  });

  it('sharing a scam check notifies only the selected, permitted user', async () => {
    const somsri = await env.as('somsri');
    const sc = json(await somsri.post('/me/scam-checks', { text: '[SYNTHETIC] คุณได้รับรางวัล กดลิงก์' }));
    await somsri.post(`/me/scam-checks/${sc.id}/share`, { shareWithUserIds: [env.ids.nok] });
    await env.queue.drain(JOB_DELIVER);
    const alerts = json<any[]>(await (await env.as('nok')).get('/alerts'));
    const a = alerts.find((x) => x.kind === 'shared_scam_check' && x.deliveries[0].state === 'sent');
    expect(a).toBeTruthy();
    expect(json<any[]>(await (await env.as('pim')).get('/alerts')).filter((x) => x.kind === 'shared_scam_check')).toHaveLength(0);
  });
});
