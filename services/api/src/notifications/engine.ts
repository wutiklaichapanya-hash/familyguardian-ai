// Notification engine:
//   Signal → rule evaluation → consent check → Alert + Notification rows ('queued')
//   → worker delivers via adapter → 'sent' | retry (backoff) up to N retries → 'failed'
//   Consent is re-checked at delivery time → 'cancelled_no_consent' if revoked.
//   Recipient marks 'seen' / 'acknowledged'. Unacknowledged help → follow-up to the next permitted contact.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ALERT_KIND_CATEGORY, type AlertKind, type AlertOrigin, type Role, type ShareCategory } from '@fg/shared';
import type { Db, Tx } from '../db/client';
import { actionLogs, alerts, notifications, users } from '../db/schema';
import type { Policy } from '../policy';
import { recordAudit } from '../audit';
import { notFound, conflict } from '../errors';
import type { AppConfig } from '../config';
import type { DeliveryAdapter } from './adapter';
import { JOB_DELIVER, JOB_FOLLOWUP, type JobQueue } from './queue';
import { notificationCopy } from './copy';

export type Signal =
  | { type: 'help_request'; seniorId: string; message?: string }
  | { type: 'scam_check_shared'; seniorId: string; itemId: string; recipientIds: string[] }
  | { type: 'transfer_pause_shared'; seniorId: string; itemId: string; recipientIds: string[] };

interface Rule { kind: AlertKind; origin: AlertOrigin; category: ShareCategory; followUp: boolean }

/** Rule evaluation: what kind of alert, which consent category, whether follow-up applies. */
export function evaluateRule(s: Signal): Rule {
  switch (s.type) {
    case 'help_request': return { kind: 'user_requested_help', origin: 'user_requested', category: ALERT_KIND_CATEGORY.user_requested_help, followUp: true };
    case 'scam_check_shared': return { kind: 'shared_scam_check', origin: 'system_warning', category: ALERT_KIND_CATEGORY.shared_scam_check, followUp: false };
    case 'transfer_pause_shared': return { kind: 'shared_transfer_pause', origin: 'system_warning', category: ALERT_KIND_CATEGORY.shared_transfer_pause, followUp: false };
  }
}

export class NotificationEngine {
  constructor(
    private db: Db,
    private policy: Policy,
    private queue: JobQueue,
    public adapter: DeliveryAdapter,
    private config: AppConfig,
    private log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void } = { info() {}, warn() {} },
  ) {}

  async startWorkers() {
    await this.queue.work(JOB_DELIVER, async (d) => { await this.deliver(String(d.notificationId)); });
    await this.queue.work(JOB_FOLLOWUP, async (d) => { await this.followUp(String(d.alertId)); });
  }

  /** Signal entry point. Returns the alert id. Recipients without consent never get a row. */
  async emit(signal: Signal): Promise<string> {
    const rule = evaluateRule(signal);
    const [senior] = await this.db.select().from(users).where(eq(users.id, signal.seniorId));
    if (!senior) throw notFound('Senior not found');

    const { alertId, notificationIds } = await this.db.transaction(async (tx) => {
      // Consent check
      let recipients = await this.policy.permittedRecipients(signal.seniorId, rule.category, tx);
      if (signal.type !== 'help_request') {
        const wanted = new Set(signal.recipientIds);
        recipients = recipients.filter((r) => wanted.has(r.userId));
      }
      const [alert] = await tx.insert(alerts).values({
        seniorId: signal.seniorId, kind: rule.kind, origin: rule.origin, category: rule.category,
        summary: notificationCopy(rule.kind, senior.displayName, 'en').title,
        seniorMessage: signal.type === 'help_request' ? (signal.message?.trim() || null) : null,
        sourceId: signal.type === 'help_request' ? null : signal.itemId,
      }).returning({ id: alerts.id });
      const ids: string[] = [];
      for (const r of recipients) {
        const copy = notificationCopy(rule.kind, senior.displayName, r.locale);
        const [n] = await tx.insert(notifications).values({
          alertId: alert!.id, seniorId: signal.seniorId, recipientId: r.userId, category: rule.category,
          channel: 'push_simulated', title: copy.title, body: copy.body, state: 'queued',
        }).returning({ id: notifications.id });
        ids.push(n!.id);
      }
      if (signal.type === 'help_request') {
        if (recipients.length > 0) {
          await tx.insert(actionLogs).values({ userId: signal.seniorId, kind: 'help_request_sent', label: `Help request queued for ${recipients.length} member(s) (simulated notification)` });
        }
      }
      await recordAudit(tx, { actorId: signal.seniorId, seniorId: signal.seniorId, action: `alert.created.${rule.kind}`, targetType: 'alert', targetId: alert!.id, meta: { recipients: recipients.length } });
      return { alertId: alert!.id, notificationIds: ids };
    });

    for (const id of notificationIds) await this.queue.send(JOB_DELIVER, { notificationId: id });
    // No eligible recipients → nothing is queued and no follow-up; the API reports noRecipients (SR-12).
    if (rule.followUp && notificationIds.length > 0) await this.queue.send(JOB_FOLLOWUP, { alertId }, this.config.helpFollowupMinutes * 60);
    return alertId;
  }

  /** Worker step: deliver one notification. Idempotent: only acts on 'queued'. */
  async deliver(notificationId: string): Promise<void> {
    const outcome = await this.db.transaction(async (tx) => {
      const [n] = await tx.select().from(notifications).where(eq(notifications.id, notificationId)).for('update');
      if (!n || n.state !== 'queued') return null;
      const [recipient] = await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, n.recipientId));
      // Re-check consent at delivery time.
      const d = recipient ? await this.policy.authorize({ userId: recipient.id, role: recipient.role }, 'notify', n.seniorId, n.category, tx) : null;
      if (!d || !d.allowed) {
        await tx.update(notifications).set({ state: 'cancelled_no_consent', updatedAt: new Date() }).where(eq(notifications.id, n.id));
        return { state: 'cancelled_no_consent' as const };
      }
      const attempts = n.attempts + 1;
      try {
        await this.adapter.deliver({ id: n.id, recipientId: n.recipientId, channel: n.channel, title: n.title, body: n.body });
        await tx.update(notifications).set({ state: 'sent', attempts, sentAt: new Date(), updatedAt: new Date(), lastError: null }).where(eq(notifications.id, n.id));
        return { state: 'sent' as const };
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const exhausted = attempts > this.config.notifyMaxRetries; // 1 initial attempt + N retries
        await tx.update(notifications).set({ state: exhausted ? 'failed' : 'queued', attempts, lastError: err.slice(0, 200), updatedAt: new Date() }).where(eq(notifications.id, n.id));
        return exhausted ? { state: 'failed' as const } : { state: 'retry' as const, delay: this.config.notifyRetryBaseSeconds * 2 ** (attempts - 1) };
      }
    });
    if (outcome?.state === 'retry') await this.queue.send(JOB_DELIVER, { notificationId }, outcome.delay);
    if (outcome?.state === 'failed') this.log.warn({ notificationId }, 'notification delivery failed after retries');
  }

  /** Follow-up for an unacknowledged help alert: notify the next permitted member who has not had a follow-up yet. */
  async followUp(alertId: string): Promise<void> {
    const [alert] = await this.db.select().from(alerts).where(eq(alerts.id, alertId));
    if (!alert || alert.acknowledgedAt) return;
    const [senior] = await this.db.select().from(users).where(eq(users.id, alert.seniorId));
    if (!senior) return;
    const permitted = await this.policy.permittedRecipients(alert.seniorId, ALERT_KIND_CATEGORY[alert.kind]);
    const already = await this.db.select({ recipientId: notifications.recipientId }).from(notifications)
      .where(and(eq(notifications.alertId, alertId), eq(notifications.isFollowUp, true)));
    const done = new Set(already.map((r) => r.recipientId));
    const next = permitted.find((p) => !done.has(p.userId));
    if (!next) {
      await recordAudit(this.db, { seniorId: alert.seniorId, action: 'alert.followup_exhausted', targetType: 'alert', targetId: alertId });
      return;
    }
    const copy = notificationCopy(alert.kind, senior.displayName, next.locale, true);
    const [n] = await this.db.insert(notifications).values({
      alertId, seniorId: alert.seniorId, recipientId: next.userId, category: alert.category,
      channel: 'push_simulated', title: copy.title, body: copy.body, state: 'queued', isFollowUp: true,
    }).returning({ id: notifications.id });
    await recordAudit(this.db, { seniorId: alert.seniorId, action: 'alert.followup', targetType: 'alert', targetId: alertId });
    await this.queue.send(JOB_DELIVER, { notificationId: n!.id });
    await this.queue.send(JOB_FOLLOWUP, { alertId }, this.config.helpFollowupMinutes * 60);
  }

  async markSeen(notificationId: string, userId: string) {
    const [n] = await this.db.select().from(notifications).where(eq(notifications.id, notificationId));
    if (!n || n.recipientId !== userId) throw notFound('Notification not found');
    if (n.state === 'sent') {
      await this.db.update(notifications).set({ state: 'seen', seenAt: new Date(), updatedAt: new Date() }).where(eq(notifications.id, n.id));
    } else if (n.state !== 'seen' && n.state !== 'acknowledged') {
      throw conflict('INVALID_STATE', `Cannot mark a ${n.state} notification as seen`);
    }
  }

  /** Recipient acknowledges an alert. Requires a notification for that alert and current consent. */
  async acknowledge(alertId: string, actor: { userId: string; role: Role; displayName: string }) {
    const [alert] = await this.db.select().from(alerts).where(eq(alerts.id, alertId));
    if (!alert) throw notFound('Alert not found');
    const mine = await this.db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.alertId, alertId), eq(notifications.recipientId, actor.userId)));
    if (mine.length === 0) throw notFound('Alert not found');
    if (!(await this.policy.canSeeAlert(actor, alert))) throw notFound('Alert not found');
    const now = new Date();
    await this.db.transaction(async (tx) => {
      if (!alert.acknowledgedAt) {
        await tx.update(alerts).set({ acknowledgedBy: actor.userId, acknowledgedAt: now }).where(and(eq(alerts.id, alertId), sql`${alerts.acknowledgedAt} is null`));
        await tx.insert(actionLogs).values({ userId: alert.seniorId, kind: 'alert_acknowledged', label: `Acknowledged by ${actor.displayName}` });
        await recordAudit(tx, { actorId: actor.userId, seniorId: alert.seniorId, action: 'alert.acknowledged', targetType: 'alert', targetId: alertId });
      }
      // F-1: the acknowledging recipient's own deliveries become 'acknowledged' — including one still 'queued'
      // (ack before the worker ran); the worker only acts on 'queued', so it will not flip it back to 'sent'.
      await tx.update(notifications).set({ state: 'acknowledged', acknowledgedAt: now, updatedAt: now })
        .where(and(inArray(notifications.id, mine.map((m) => m.id)), inArray(notifications.state, ['queued', 'sent', 'seen', 'failed'])));
    });
  }

  /** After a revoke: strip already-delivered content and stop queued deliveries for that grantee × category. */
  async onConsentRevoked(seniorId: string, granteeUserId: string, categories: ShareCategory[], tx: Tx = this.db) {
    if (categories.length === 0) return;
    await tx.update(notifications).set({ contentRevoked: true, updatedAt: new Date() })
      .where(and(eq(notifications.seniorId, seniorId), eq(notifications.recipientId, granteeUserId), inArray(notifications.category, categories)));
    // Rows still 'queued' are cancelled by the delivery-time consent re-check ('cancelled_no_consent').
  }
}
