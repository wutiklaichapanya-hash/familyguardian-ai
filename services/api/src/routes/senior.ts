// Senior-owned data: check-ins, contacts, call/action logs, help requests, ScamShield, Guardian Pause.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { assessScam, evaluateGuardianPause } from '@fg/ai';
import type { GuardianPauseEngineResult, ScamEngineResult, ShareCategory } from '@fg/shared';
import { type Ctx, actorOf, requireRole } from '../app';
import { requireOwner } from '../circles';
import {
  actionLogs, alerts, contentShares, directoryEntries, guardianPauseSessions, scamAssessments, trustedContacts, wellbeingCheckins,
} from '../db/schema';
import { recordAudit } from '../audit';
import { notFound } from '../errors';
import { toActionLogDTO, toCheckinDTO, toContactDTO, toPauseDTO, toScamDTO } from '../dto';
import { buildAlertDTOs } from '../alertsView';
import {
  callLogReq, createCheckinReq, createContactReq, daysQuery, doc, guardianPauseReq, helpRequestReq, idParam, scamCheckReq, shareReq,
} from '../validation';

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

export default async function seniorRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, policy, engine, config } = ctx;
  // [senior]: caller must own the family; then the policy confirms the write on their own data.
  const senior = async (req: FastifyRequest, category: ShareCategory) => {
    const { user } = await requireOwner(db, req.user);
    await policy.assert(actorOf(user), 'write', user.id, category);
    return user;
  };
  const sharedWith = async (category: ShareCategory, itemIds: string[]) => {
    const m = new Map<string, string[]>();
    if (itemIds.length === 0) return m;
    const rows = await db.select({ itemId: contentShares.itemId, userId: contentShares.userId }).from(contentShares)
      .where(and(eq(contentShares.category, category), inArray(contentShares.itemId, itemIds)));
    for (const r of rows) m.set(r.itemId, [...(m.get(r.itemId) ?? []), r.userId]);
    return m;
  };
  const limit = (max: number) => ({ rateLimit: { max, timeWindow: '1 minute', keyGenerator: (req: FastifyRequest) => `u|${req.cookies.fg_session ?? req.ip}` } });

  // ---- Check-ins ----
  app.post('/me/checkins', { schema: { tags: ['checkins'], summary: 'Create a check-in (senior)', body: doc(createCheckinReq) } }, async (req) => {
    const u = await senior(req, 'checkins');
    const b = createCheckinReq.parse(req.body);
    const onlyMe = b.onlyMe ?? false;
    const [row] = await db.insert(wellbeingCheckins).values({
      seniorId: u.id, mood: b.mood, note: b.note || null,
      noteShared: onlyMe ? false : (b.noteShared ?? false), onlyMe,
    }).returning();
    return toCheckinDTO(row!);
  });

  app.get('/me/checkins', { schema: { tags: ['checkins'], summary: 'My check-ins' } }, async (req) => {
    const u = await senior(req, 'checkins');
    const { days } = daysQuery.parse(req.query);
    const rows = await db.select().from(wellbeingCheckins)
      .where(and(eq(wellbeingCheckins.seniorId, u.id), gte(wellbeingCheckins.createdAt, since(days))))
      .orderBy(desc(wellbeingCheckins.createdAt));
    return rows.map(toCheckinDTO);
  });

  // ---- Trusted contacts ----
  app.get('/me/contacts', { schema: { tags: ['contacts'], summary: 'My trusted contacts' } }, async (req) => {
    const u = await senior(req, 'contacts');
    const rows = await db.select().from(trustedContacts).where(eq(trustedContacts.seniorId, u.id)).orderBy(trustedContacts.createdAt);
    return rows.map(toContactDTO);
  });

  app.post('/me/contacts', { schema: { tags: ['contacts'], summary: 'Add a trusted contact', body: doc(createContactReq) } }, async (req) => {
    const u = await senior(req, 'contacts');
    const b = createContactReq.parse(req.body);
    const [row] = await db.insert(trustedContacts).values({ seniorId: u.id, ...b }).returning();
    await recordAudit(db, { actorId: u.id, seniorId: u.id, action: 'contact.created', targetType: 'contact', targetId: row!.id });
    return toContactDTO(row!);
  });

  app.delete('/me/contacts/:id', { schema: { tags: ['contacts'], summary: 'Remove a trusted contact' } }, async (req, reply) => {
    const u = await senior(req, 'contacts');
    const { id } = idParam.parse(req.params);
    const res = await db.delete(trustedContacts).where(and(eq(trustedContacts.id, id), eq(trustedContacts.seniorId, u.id))).returning({ id: trustedContacts.id });
    if (res.length === 0) throw notFound('Contact not found');
    await recordAudit(db, { actorId: u.id, seniorId: u.id, action: 'contact.deleted', targetType: 'contact', targetId: id });
    return reply.status(204).send();
  });

  // ---- Call / action logs ----
  app.post('/me/call-logs', { schema: { tags: ['contacts'], summary: "Record 'call started from app' (never 'connected')", body: doc(callLogReq) } }, async (req) => {
    const u = requireRole(req, 'senior', 'family', 'caregiver');
    const b = callLogReq.parse(req.body);
    let label: string; let target: string;
    if (b.contactId) {
      const [c] = await db.select().from(trustedContacts).where(and(eq(trustedContacts.id, b.contactId), eq(trustedContacts.seniorId, u.id)));
      if (!c) throw notFound('Contact not found');
      label = `Call started from app: ${c.name}`; target = c.name;
    } else {
      const [d] = await db.select().from(directoryEntries).where(eq(directoryEntries.id, b.directoryEntryId!));
      if (!d) throw notFound('Directory entry not found');
      label = `Call started from app: ${d.nameEn} (${d.phone})`; target = d.phone;
    }
    const [row] = await db.insert(actionLogs).values({ userId: u.id, kind: 'call_started_from_app', label, target }).returning();
    return toActionLogDTO(row!);
  });

  app.get('/me/action-logs', { schema: { tags: ['contacts'], summary: 'My action log' } }, async (req) => {
    const u = requireRole(req, 'senior', 'family', 'caregiver');
    const rows = await db.select().from(actionLogs).where(eq(actionLogs.userId, u.id)).orderBy(desc(actionLogs.createdAt)).limit(200);
    return rows.map(toActionLogDTO);
  });

  // ---- Help requests & my alerts ----
  app.post('/me/help-requests', { config: limit(config.helpRateLimitMax), schema: { tags: ['alerts'], summary: 'Request help (senior)', body: doc(helpRequestReq) } }, async (req) => {
    const u = await senior(req, 'help_requests');
    const b = helpRequestReq.parse(req.body ?? {});
    const alertId = await engine.emit({ type: 'help_request', seniorId: u.id, message: b.message });
    const [a] = await db.select().from(alerts).where(eq(alerts.id, alertId));
    return (await buildAlertDTOs(db, [a!], u, true))[0];
  });

  app.get('/me/alerts', { schema: { tags: ['alerts'], summary: 'Alerts about me, with delivery states (senior)' } }, async (req) => {
    const { user: u } = await requireOwner(db, req.user);
    const rows = await db.select().from(alerts).where(eq(alerts.seniorId, u.id)).orderBy(desc(alerts.createdAt)).limit(100);
    return buildAlertDTOs(db, rows, u, true);
  });

  // ---- ScamShield ----
  app.post('/me/scam-checks', { config: limit(config.scamCheckRateLimitMax), schema: { tags: ['scamshield'], summary: 'Check a suspicious message (senior)', body: doc(scamCheckReq) } }, async (req) => {
    const u = await senior(req, 'scam_checks');
    const b = scamCheckReq.parse(req.body);
    const result: ScamEngineResult = assessScam({ ...b, locale: b.locale ?? u.locale });
    const [row] = await db.insert(scamAssessments).values({
      seniorId: u.id, inputText: b.text ?? null, inputUrl: b.url ?? null, inputPhone: b.phone ?? null, locale: b.locale ?? u.locale,
      risk: result.risk, result,
    }).returning();
    await recordAudit(db, { actorId: u.id, seniorId: u.id, action: 'scam_check.created', targetType: 'scam_check', targetId: row!.id, meta: { risk: result.risk } });
    return toScamDTO(row!, []);
  });

  app.get('/me/scam-checks', { schema: { tags: ['scamshield'], summary: 'My scam checks' } }, async (req) => {
    const u = await senior(req, 'scam_checks');
    const rows = await db.select().from(scamAssessments).where(eq(scamAssessments.seniorId, u.id)).orderBy(desc(scamAssessments.createdAt)).limit(100);
    const sw = await sharedWith('scam_checks', rows.map((r) => r.id));
    return rows.map((r) => toScamDTO(r, sw.get(r.id) ?? []));
  });

  app.post('/me/scam-checks/:id/share', { config: limit(30), schema: { tags: ['scamshield'], summary: "Share a scam check (recipients must hold 'scam_checks')", body: doc(shareReq) } }, async (req) => {
    const u = await senior(req, 'scam_checks');
    const { id } = idParam.parse(req.params);
    const shareWithUserIds = [...new Set(shareReq.parse(req.body).shareWithUserIds)];
    const [item] = await db.select().from(scamAssessments).where(and(eq(scamAssessments.id, id), eq(scamAssessments.seniorId, u.id)));
    if (!item) throw notFound('Scam check not found');
    await policy.assertAllPermitted(u.id, 'scam_checks', shareWithUserIds);
    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(contentShares).values(shareWithUserIds.map((userId) => ({ seniorId: u.id, category: 'scam_checks' as const, itemId: id, userId }))).onConflictDoNothing();
      await recordAudit(tx, { actorId: u.id, seniorId: u.id, action: 'scam_check.shared', targetType: 'scam_check', targetId: id, meta: { recipients: shareWithUserIds.length } });
      return tx.update(scamAssessments).set({ shared: true }).where(eq(scamAssessments.id, id)).returning();
    });
    await engine.emit({ type: 'scam_check_shared', seniorId: u.id, itemId: id, recipientIds: shareWithUserIds });
    return toScamDTO(updated!, (await sharedWith('scam_checks', [id])).get(id) ?? []);
  });

  // ---- Guardian Pause ----
  app.post('/me/guardian-pause', { schema: { tags: ['guardian-pause'], summary: 'Pause before a transfer (simulation only)', body: doc(guardianPauseReq) } }, async (req) => {
    const u = await senior(req, 'transfer_pauses');
    const b = guardianPauseReq.parse(req.body);
    const r: GuardianPauseEngineResult = evaluateGuardianPause(b);
    const [row] = await db.insert(guardianPauseSessions).values({
      seniorId: u.id, amountThb: b.amountThb, answers: b.answers, recipientNote: b.recipientNote ?? null, level: r.level, reasons: r.reasons,
    }).returning();
    await recordAudit(db, { actorId: u.id, seniorId: u.id, action: 'guardian_pause.created', targetType: 'guardian_pause', targetId: row!.id, meta: { level: r.level } });
    return toPauseDTO(row!, []);
  });

  app.get('/me/guardian-pause', { schema: { tags: ['guardian-pause'], summary: 'My Guardian Pause sessions' } }, async (req) => {
    const u = await senior(req, 'transfer_pauses');
    const rows = await db.select().from(guardianPauseSessions).where(eq(guardianPauseSessions.seniorId, u.id)).orderBy(desc(guardianPauseSessions.createdAt)).limit(100);
    const sw = await sharedWith('transfer_pauses', rows.map((r) => r.id));
    return rows.map((r) => toPauseDTO(r, sw.get(r.id) ?? []));
  });

  app.post('/me/guardian-pause/:id/share', { config: limit(30), schema: { tags: ['guardian-pause'], summary: "Share a pause (recipients must hold 'transfer_pauses')", body: doc(shareReq) } }, async (req) => {
    const u = await senior(req, 'transfer_pauses');
    const { id } = idParam.parse(req.params);
    const shareWithUserIds = [...new Set(shareReq.parse(req.body).shareWithUserIds)];
    const [item] = await db.select().from(guardianPauseSessions).where(and(eq(guardianPauseSessions.id, id), eq(guardianPauseSessions.seniorId, u.id)));
    if (!item) throw notFound('Guardian Pause session not found');
    await policy.assertAllPermitted(u.id, 'transfer_pauses', shareWithUserIds);
    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(contentShares).values(shareWithUserIds.map((userId) => ({ seniorId: u.id, category: 'transfer_pauses' as const, itemId: id, userId }))).onConflictDoNothing();
      await recordAudit(tx, { actorId: u.id, seniorId: u.id, action: 'guardian_pause.shared', targetType: 'guardian_pause', targetId: id, meta: { recipients: shareWithUserIds.length } });
      return tx.update(guardianPauseSessions).set({ shared: true }).where(eq(guardianPauseSessions.id, id)).returning();
    });
    await engine.emit({ type: 'transfer_pause_shared', seniorId: u.id, itemId: id, recipientIds: shareWithUserIds });
    return toPauseDTO(updated!, (await sharedWith('transfer_pauses', [id])).get(id) ?? []);
  });
}
