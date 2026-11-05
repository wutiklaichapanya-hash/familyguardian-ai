// Grantee-side views: shared check-ins/scam checks/pauses/contacts, alerts, notifications, dashboard.
// Every read of another person's data goes through policy.assert/authorize('read') → access-log row; denial → 404.
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, inArray, isNull, ne } from 'drizzle-orm';
import {
  ALERT_KIND_CATEGORY, SHARE_CATEGORIES, type DashboardDTO, type DashboardSeniorCard, type DashboardStatus, type ShareCategory,
} from '@fg/shared';
import { type Ctx, actorOf, requireRole, requireUser } from '../app';
import {
  alerts, contentShares, families, familyMemberships, guardianPauseSessions, notifications, scamAssessments, trustedContacts, users, wellbeingCheckins,
} from '../db/schema';
import { notFound } from '../errors';
import { toContactDTO, toNotificationDTO, toSharedCheckinDTO, toSharedPauseDTO, toSharedScamDTO } from '../dto';
import { buildAlertDTOs } from '../alertsView';
import { daysQuery, idParam, seniorParam } from '../validation';

const since = (days: number) => new Date(Date.now() - days * 86_400_000);
const STATUS_CATEGORIES: readonly ShareCategory[] = ['checkins', 'help_requests', 'scam_checks', 'transfer_pauses'];

export default async function viewerRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, policy, engine } = ctx;
  const viewer = (req: Parameters<typeof requireUser>[0]) => requireRole(req, 'family', 'caregiver', 'senior', 'admin', 'org_admin');

  const sharedItemIds = async (category: ShareCategory, seniorId: string, userId: string) =>
    (await db.select({ itemId: contentShares.itemId }).from(contentShares)
      .where(and(eq(contentShares.category, category), eq(contentShares.seniorId, seniorId), eq(contentShares.userId, userId)))).map((r) => r.itemId);

  app.get('/seniors/:seniorId/checkins', { schema: { tags: ['checkins'], summary: "Shared check-ins ('checkins' grant). onlyMe excluded in SQL." } }, async (req) => {
    const u = viewer(req);
    const { seniorId } = seniorParam.parse(req.params);
    const { days } = daysQuery.parse(req.query);
    await policy.assert(actorOf(u), 'read', seniorId, 'checkins');
    const rows = await db.select().from(wellbeingCheckins)
      .where(and(eq(wellbeingCheckins.seniorId, seniorId), eq(wellbeingCheckins.onlyMe, false), gte(wellbeingCheckins.createdAt, since(days))))
      .orderBy(desc(wellbeingCheckins.createdAt));
    return rows.map(toSharedCheckinDTO);
  });

  app.get('/seniors/:seniorId/scam-checks', { schema: { tags: ['scamshield'], summary: "Scam checks shared WITH ME ('scam_checks' grant)" } }, async (req) => {
    const u = viewer(req);
    const { seniorId } = seniorParam.parse(req.params);
    await policy.assert(actorOf(u), 'read', seniorId, 'scam_checks');
    const ids = await sharedItemIds('scam_checks', seniorId, u.id);
    if (ids.length === 0) return [];
    const rows = await db.select().from(scamAssessments).where(and(eq(scamAssessments.seniorId, seniorId), inArray(scamAssessments.id, ids))).orderBy(desc(scamAssessments.createdAt));
    return rows.map(toSharedScamDTO);
  });

  app.get('/seniors/:seniorId/guardian-pause', { schema: { tags: ['guardian-pause'], summary: "Pauses shared WITH ME ('transfer_pauses' grant; amount bucket only)" } }, async (req) => {
    const u = viewer(req);
    const { seniorId } = seniorParam.parse(req.params);
    await policy.assert(actorOf(u), 'read', seniorId, 'transfer_pauses');
    const ids = await sharedItemIds('transfer_pauses', seniorId, u.id);
    if (ids.length === 0) return [];
    const rows = await db.select().from(guardianPauseSessions).where(and(eq(guardianPauseSessions.seniorId, seniorId), inArray(guardianPauseSessions.id, ids))).orderBy(desc(guardianPauseSessions.createdAt));
    return rows.map(toSharedPauseDTO);
  });

  // Not in contract v0.2 (requested): grantee view of trusted contacts ('contacts' grant).
  app.get('/seniors/:seniorId/contacts', { schema: { tags: ['contacts'], summary: "Senior's trusted contacts ('contacts' grant)" } }, async (req) => {
    const u = viewer(req);
    const { seniorId } = seniorParam.parse(req.params);
    await policy.assert(actorOf(u), 'read', seniorId, 'contacts');
    const rows = await db.select().from(trustedContacts).where(eq(trustedContacts.seniorId, seniorId)).orderBy(trustedContacts.createdAt);
    return rows.map(toContactDTO);
  });

  // ---- Alerts (recipient view) ----
  app.get('/alerts', { schema: { tags: ['alerts'], summary: 'Alerts addressed to me (grant re-checked)' } }, async (req) => {
    const u = requireUser(req);
    const mine = await db.selectDistinct({ alertId: notifications.alertId }).from(notifications)
      .where(and(eq(notifications.recipientId, u.id), ne(notifications.state, 'cancelled_no_consent')));
    const ids = mine.map((m) => m.alertId).filter((x): x is string => !!x);
    if (ids.length === 0) return [];
    const rows = await db.select().from(alerts).where(inArray(alerts.id, ids)).orderBy(desc(alerts.createdAt)).limit(100);
    const visible = [];
    for (const a of rows) if (await policy.canSeeAlert(actorOf(u), a)) visible.push(a);
    return buildAlertDTOs(db, visible, u, false);
  });

  const loadVisibleAlert = async (u: ReturnType<typeof requireUser>, id: string) => {
    const [a] = await db.select().from(alerts).where(eq(alerts.id, id));
    if (!a) throw notFound();
    const asOwner = a.seniorId === u.id;
    if (!(await policy.canSeeAlert(actorOf(u), a))) throw notFound();
    return { a, asOwner };
  };

  app.get('/alerts/:id', { schema: { tags: ['alerts'], summary: 'One alert (grant re-checked; else 404)' } }, async (req) => {
    const u = requireUser(req);
    const { id } = idParam.parse(req.params);
    const { a, asOwner } = await loadVisibleAlert(u, id);
    return (await buildAlertDTOs(db, [a], u, asOwner))[0];
  });

  app.post('/alerts/:id/ack', { schema: { tags: ['alerts'], summary: 'Acknowledge an alert (grant re-checked; else 404)' } }, async (req) => {
    const u = requireUser(req);
    const { id } = idParam.parse(req.params);
    await engine.acknowledge(id, { userId: u.id, role: u.role, displayName: u.displayName });
    const [a] = await db.select().from(alerts).where(eq(alerts.id, id));
    return (await buildAlertDTOs(db, [a!], u, false))[0];
  });

  // ---- Notifications ----
  /** Is the content behind a notification still visible to its recipient? (no access-log row: bodies are generic) */
  const stillVisible = async (u: ReturnType<typeof requireUser>, ns: (typeof notifications.$inferSelect)[]) => {
    const cache = new Map<string, boolean>();
    const alertIds = ns.map((n) => n.alertId).filter((x): x is string => !!x);
    const srcs = new Map((alertIds.length ? await db.select({ id: alerts.id, sourceId: alerts.sourceId, kind: alerts.kind }).from(alerts).where(inArray(alerts.id, alertIds)) : []).map((a) => [a.id, a]));
    const out = new Map<string, boolean>();
    for (const n of ns) {
      const key = `${n.seniorId}|${n.category}`;
      if (!cache.has(key)) cache.set(key, (await policy.authorize(actorOf(u), 'notify', n.seniorId, n.category)).allowed);
      let ok = cache.get(key)!;
      const src = n.alertId ? srcs.get(n.alertId) : undefined;
      if (!src) ok = false; // alert deleted
      else if (ok && src.sourceId && (n.category === 'scam_checks' || n.category === 'transfer_pauses')) {
        ok = await policy.isSharedWith(ALERT_KIND_CATEGORY[src.kind], src.sourceId, u.id);
      }
      out.set(n.id, ok);
    }
    return out;
  };

  app.get('/notifications', { schema: { tags: ['notifications'], summary: 'My notifications (generic text once content is unavailable)' } }, async (req) => {
    const u = requireUser(req);
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.recipientId, u.id), ne(notifications.state, 'cancelled_no_consent')))
      .orderBy(desc(notifications.createdAt)).limit(100);
    const vis = await stillVisible(u, rows);
    return rows.map((n) => toNotificationDTO(n, vis.get(n.id) ?? false, u.locale));
  });

  app.post('/notifications/:id/seen', { schema: { tags: ['notifications'], summary: 'Mark a notification seen' } }, async (req) => {
    const u = requireUser(req);
    const { id } = idParam.parse(req.params);
    await engine.markSeen(id, u.id);
    const [n] = await db.select().from(notifications).where(eq(notifications.id, id));
    const vis = await stillVisible(u, [n!]);
    return toNotificationDTO(n!, vis.get(n!.id) ?? false, u.locale);
  });

  // ---- Dashboard (family/caregiver) ----
  app.get('/dashboard', { schema: { tags: ['dashboard'], summary: 'Per-viewer family dashboard (only granted, shared-with-me data)' } }, async (req): Promise<DashboardDTO> => {
    const u = requireRole(req, 'family', 'caregiver');
    const actor = actorOf(u);
    const circles = await db.select({ seniorId: families.seniorId, seniorName: users.displayName, relationship: familyMemberships.relationship })
      .from(familyMemberships).innerJoin(families, eq(families.id, familyMemberships.familyId)).innerJoin(users, eq(users.id, families.seniorId))
      .where(and(eq(familyMemberships.userId, u.id), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')));

    const seniors: DashboardSeniorCard[] = [];
    for (const c of circles) {
      const visible = await policy.visibleCategories(actor, c.seniorId, SHARE_CATEGORIES);
      const card: DashboardSeniorCard = { seniorId: c.seniorId, seniorName: c.seniorName, relationship: c.relationship, status: 'not_shared', visibleCategories: visible };
      const relevant = visible.filter((v) => STATUS_CATEGORIES.includes(v));
      const times: number[] = [];
      let assistance = false; let verify = false; let checkInRec = false;
      const week = since(7);

      if (relevant.includes('checkins') && (await policy.authorize(actor, 'read', c.seniorId, 'checkins')).allowed) {
        const [latest] = await db.select().from(wellbeingCheckins)
          .where(and(eq(wellbeingCheckins.seniorId, c.seniorId), eq(wellbeingCheckins.onlyMe, false)))
          .orderBy(desc(wellbeingCheckins.createdAt)).limit(1);
        card.latestCheckin = latest ? { mood: latest.mood, at: latest.createdAt.toISOString(), note: latest.noteShared ? latest.note : null } : null;
        if (latest) { times.push(latest.createdAt.getTime()); checkInRec = latest.mood === 'lonely' || latest.mood === 'worried'; }
      }
      if (relevant.includes('help_requests') && (await policy.authorize(actor, 'read', c.seniorId, 'help_requests')).allowed) {
        const mine = await db.selectDistinct({ alertId: notifications.alertId }).from(notifications)
          .where(and(eq(notifications.recipientId, u.id), eq(notifications.seniorId, c.seniorId), eq(notifications.category, 'help_requests'), ne(notifications.state, 'cancelled_no_consent')));
        const ids = mine.map((m) => m.alertId).filter((x): x is string => !!x);
        const pending = ids.length ? await db.select().from(alerts)
          .where(and(inArray(alerts.id, ids), eq(alerts.kind, 'user_requested_help'), isNull(alerts.acknowledgedAt))).orderBy(desc(alerts.createdAt)) : [];
        card.pendingAlerts = await buildAlertDTOs(db, pending, u, false);
        assistance = pending.length > 0;
        for (const a of pending) times.push(a.createdAt.getTime());
      }
      if (relevant.includes('scam_checks') && (await policy.authorize(actor, 'read', c.seniorId, 'scam_checks')).allowed) {
        const ids = await sharedItemIds('scam_checks', c.seniorId, u.id);
        const rows = ids.length ? await db.select().from(scamAssessments)
          .where(and(inArray(scamAssessments.id, ids), gte(scamAssessments.createdAt, since(30)))).orderBy(desc(scamAssessments.createdAt)).limit(10) : [];
        card.sharedScamChecks = rows.map(toSharedScamDTO);
        if (rows.some((r) => r.createdAt >= week && (r.risk === 'caution' || r.risk === 'high_risk'))) verify = true;
        for (const r of rows) times.push(r.createdAt.getTime());
      }
      if (relevant.includes('transfer_pauses') && (await policy.authorize(actor, 'read', c.seniorId, 'transfer_pauses')).allowed) {
        const ids = await sharedItemIds('transfer_pauses', c.seniorId, u.id);
        const rows = ids.length ? await db.select().from(guardianPauseSessions)
          .where(and(inArray(guardianPauseSessions.id, ids), gte(guardianPauseSessions.createdAt, since(30)))).orderBy(desc(guardianPauseSessions.createdAt)).limit(10) : [];
        card.sharedTransferPauses = rows.map(toSharedPauseDTO);
        if (rows.some((r) => r.createdAt >= week && r.level === 'stop_and_verify')) verify = true;
        for (const r of rows) times.push(r.createdAt.getTime());
      }

      let status: DashboardStatus = 'not_shared';
      if (relevant.length > 0) {
        status = assistance ? 'assistance_requested' : verify ? 'verify_possible_scam' : checkInRec ? 'check_in_recommended' : 'no_action_needed';
      }
      card.status = status;
      card.lastUpdatedAt = times.length ? new Date(Math.max(...times)).toISOString() : null;
      seniors.push(card);
    }
    return { seniors };
  });
}
