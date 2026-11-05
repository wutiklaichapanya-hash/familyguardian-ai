// Family Circle & consent: invitations (link token → pending → senior confirms with step-up), members, grants, access log.
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AcceptInviteRes, MemberDTO, ShareCategory } from '@fg/shared';
import { type Ctx, requireUser } from '../app';
import { requireOwner } from '../circles';
import { accessLogs, consentGrants, families, familyMemberships, invitations, users } from '../db/schema';
import { randomToken, requireStepUp, safeEqualHex, sha256 } from '../auth';
import { recordAudit } from '../audit';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { mayHoldCategory } from '../policy';
import { toAccessLogDTO, toGrantDTO, toInviteDTO } from '../dto';
import { acceptInviteReq, createGrantReq, doc, idParam, inviteReq, stepUpReq, userIdParam } from '../validation';

export const CONSENT_TEXT_VERSION = 'consent-v1';
/** Sensitive categories that need step-up to grant (contract v0.2). */
const STEP_UP_CATEGORIES: readonly ShareCategory[] = ['checkins', 'scam_checks', 'transfer_pauses'];
const DAY = 86_400_000;

export default async function circleRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config, engine } = ctx;
  const inviteInvalid = () => badRequest('INVITE_INVALID', 'This invitation link cannot be used. Ask for a new one.');

  const activeGrantsByUser = async (seniorId: string, userIds: string[]) => {
    const m = new Map<string, ShareCategory[]>();
    if (userIds.length === 0) return m;
    const rows = await db.select({ u: consentGrants.granteeUserId, c: consentGrants.category }).from(consentGrants)
      .where(and(eq(consentGrants.seniorId, seniorId), inArray(consentGrants.granteeUserId, userIds), isNull(consentGrants.revokedAt), gt(consentGrants.expiresAt, new Date())));
    for (const r of rows) m.set(r.u, [...(m.get(r.u) ?? []), r.c]);
    return m;
  };

  // ---- Invitations ----
  app.post('/me/invitations', {
    config: { rateLimit: { max: config.inviteRateLimitMax, timeWindow: '1 minute' } },
    schema: { tags: ['circle'], summary: 'Invite a member (senior). Returns the link token ONCE.', body: doc(inviteReq) },
  }, async (req) => {
    const { user, family } = await requireOwner(db, req.user);
    const b = inviteReq.parse(req.body);
    const secret = randomToken(16); // 128-bit CSPRNG
    const [row] = await db.insert(invitations).values({
      familyId: family.id, seniorId: user.id, inviteeName: b.inviteeName, relationship: b.relationship, role: b.role,
      tokenHash: sha256(secret), expiresAt: new Date(Date.now() + config.inviteTtlHours * 3_600_000),
    }).returning();
    await recordAudit(db, { actorId: user.id, seniorId: user.id, action: 'invitation.created', targetType: 'invitation', targetId: row!.id, meta: { role: b.role } });
    const token = `${row!.id}.${secret}`;
    // Token travels in the URL FRAGMENT (never sent to servers / Referer) and is POSTed in the body on accept.
    return { ...toInviteDTO(row!), token, inviteUrl: `${config.webOrigin}/invite/accept#token=${token}` };
  });

  app.get('/me/invitations', { schema: { tags: ['circle'], summary: 'My invitations (no token)' } }, async (req) => {
    const { family } = await requireOwner(db, req.user);
    const acc = alias(users, 'acc');
    const rows = await db.select({ i: invitations, accName: acc.displayName }).from(invitations)
      .leftJoin(acc, eq(acc.id, invitations.acceptedBy))
      .where(eq(invitations.familyId, family.id)).orderBy(desc(invitations.createdAt));
    return rows.map((r) => toInviteDTO(r.i, r.accName ?? null));
  });

  app.delete('/me/invitations/:id', { schema: { tags: ['circle'], summary: 'Cancel an invitation' } }, async (req, reply) => {
    const { user, family } = await requireOwner(db, req.user);
    const { id } = idParam.parse(req.params);
    const [inv] = await db.select().from(invitations).where(and(eq(invitations.id, id), eq(invitations.familyId, family.id)));
    if (!inv) throw notFound();
    if (inv.status === 'pending' || inv.status === 'pending_confirmation') {
      await db.transaction(async (tx) => {
        await tx.update(invitations).set({ status: 'cancelled' }).where(eq(invitations.id, id));
        await tx.update(familyMemberships).set({ removedAt: new Date() })
          .where(and(eq(familyMemberships.invitationId, id), eq(familyMemberships.status, 'pending_confirmation'), isNull(familyMemberships.removedAt)));
        await recordAudit(tx, { actorId: user.id, seniorId: user.id, action: 'invitation.cancelled', targetType: 'invitation', targetId: id });
      });
    }
    return reply.status(204).send();
  });

  app.post('/invitations/accept', {
    config: { rateLimit: { max: config.inviteRateLimitMax, timeWindow: '1 minute', keyGenerator: (req) => `accept|${req.ip}` } },
    schema: { tags: ['circle'], summary: 'Accept an invitation (signed-in invitee). Creates a PENDING membership with zero grants.', body: doc(acceptInviteReq) },
  }, async (req): Promise<AcceptInviteRes> => {
    const u = requireUser(req);
    const { token } = acceptInviteReq.parse(req.body);
    const [inviteId, secret] = token.split('.');
    if (!inviteId || !secret || !/^[0-9a-f-]{36}$/i.test(inviteId)) throw inviteInvalid();

    const result = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(invitations).where(eq(invitations.id, inviteId)).for('update');
      if (!inv || inv.status !== 'pending') return { ok: false as const };
      if (inv.expiresAt <= new Date()) {
        await tx.update(invitations).set({ status: 'expired' }).where(eq(invitations.id, inv.id));
        return { ok: false as const };
      }
      if (!safeEqualHex(sha256(secret), inv.tokenHash)) {
        const failed = inv.failedAttempts + 1;
        const invalidate = failed >= config.inviteMaxAttempts;
        await tx.update(invitations).set({ failedAttempts: failed, ...(invalidate ? { status: 'expired' as const } : {}) }).where(eq(invitations.id, inv.id));
        if (invalidate) await recordAudit(tx, { seniorId: inv.seniorId, action: 'invitation.invalidated_after_failed_attempts', targetType: 'invitation', targetId: inv.id });
        return { ok: false as const };
      }
      if (u.role !== 'family' && u.role !== 'caregiver') return { ok: false as const };
      if (u.id === inv.seniorId) return { ok: false as const };
      const existing = await tx.select({ id: familyMemberships.id }).from(familyMemberships)
        .where(and(eq(familyMemberships.familyId, inv.familyId), eq(familyMemberships.userId, u.id), isNull(familyMemberships.removedAt)));
      if (existing.length > 0) return { ok: false as const };
      // Single use: status flips inside the same row-locked transaction.
      await tx.update(invitations).set({ status: 'pending_confirmation', acceptedBy: u.id, acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
      await tx.insert(familyMemberships).values({
        familyId: inv.familyId, userId: u.id, role: inv.role, relationship: inv.relationship, status: 'pending_confirmation', invitationId: inv.id,
      });
      await recordAudit(tx, { actorId: u.id, seniorId: inv.seniorId, action: 'invitation.accepted_pending_confirmation', targetType: 'invitation', targetId: inv.id });
      const [senior] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, inv.seniorId));
      return { ok: true as const, seniorFirstName: (senior?.name ?? '').split(/\s+/)[0] ?? '' };
    });
    if (!result.ok) throw inviteInvalid();
    return { status: 'pending_confirmation', seniorFirstName: result.seniorFirstName };
  });

  app.post('/me/invitations/:id/confirm', { schema: { tags: ['circle'], summary: 'Confirm a pending member (senior, step-up)', body: doc(stepUpReq) } }, async (req, reply): Promise<MemberDTO> => {
    const { user, family } = await requireOwner(db, req.user);
    const { id } = idParam.parse(req.params);
    const { password } = stepUpReq.parse(req.body);
    await requireStepUp(db, config, req, reply, password);
    const [inv] = await db.select().from(invitations).where(and(eq(invitations.id, id), eq(invitations.familyId, family.id)));
    if (!inv || inv.status !== 'pending_confirmation' || !inv.acceptedBy) throw notFound();
    const now = new Date();
    const member = await db.transaction(async (tx) => {
      const [m] = await tx.update(familyMemberships).set({ status: 'active', confirmedAt: now })
        .where(and(eq(familyMemberships.invitationId, id), eq(familyMemberships.status, 'pending_confirmation'), isNull(familyMemberships.removedAt))).returning();
      if (!m) return null;
      await tx.update(invitations).set({ status: 'confirmed' }).where(eq(invitations.id, id));
      await recordAudit(tx, { actorId: user.id, seniorId: user.id, action: 'member.confirmed', targetType: 'user', targetId: m.userId });
      return m;
    });
    if (!member) throw notFound();
    const [mu] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, member.userId));
    return { userId: member.userId, name: mu?.name ?? '', role: member.role, relationship: member.relationship, joinedAt: member.joinedAt.toISOString(), activeGrants: [] };
  });

  // ---- Members (senior only; others 404 — SR-06) ----
  app.get('/me/members', { schema: { tags: ['circle'], summary: 'Confirmed members (senior only)' } }, async (req): Promise<MemberDTO[]> => {
    requireUser(req);
    const owner = await requireOwner(db, req.user).catch(() => null);
    if (!owner) throw notFound();
    const rows = await db.select({ m: familyMemberships, name: users.displayName }).from(familyMemberships)
      .innerJoin(users, eq(users.id, familyMemberships.userId))
      .where(and(eq(familyMemberships.familyId, owner.family.id), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')))
      .orderBy(familyMemberships.joinedAt);
    const grants = await activeGrantsByUser(owner.user.id, rows.map((r) => r.m.userId));
    return rows.map((r) => ({ userId: r.m.userId, name: r.name, role: r.m.role, relationship: r.m.relationship, joinedAt: r.m.joinedAt.toISOString(), activeGrants: grants.get(r.m.userId) ?? [] }));
  });

  app.delete('/me/members/:userId', { schema: { tags: ['circle'], summary: 'Remove a member + revoke all grants (senior, step-up)', body: doc(stepUpReq) } }, async (req, reply) => {
    const { user, family } = await requireOwner(db, req.user);
    const { userId } = userIdParam.parse(req.params);
    const { password } = stepUpReq.parse(req.body ?? {});
    await requireStepUp(db, config, req, reply, password);
    const now = new Date();
    const removed = await db.transaction(async (tx) => {
      const ms = await tx.update(familyMemberships).set({ removedAt: now })
        .where(and(eq(familyMemberships.familyId, family.id), eq(familyMemberships.userId, userId), isNull(familyMemberships.removedAt))).returning();
      if (ms.length === 0) return false;
      const revoked = await tx.update(consentGrants).set({ revokedAt: now })
        .where(and(eq(consentGrants.seniorId, user.id), eq(consentGrants.granteeUserId, userId), isNull(consentGrants.revokedAt))).returning();
      await engine.onConsentRevoked(user.id, userId, [...new Set(revoked.map((g) => g.category))], tx);
      await recordAudit(tx, { actorId: user.id, seniorId: user.id, action: 'member.removed', targetType: 'user', targetId: userId, meta: { grantsRevoked: revoked.length } });
      return true;
    });
    if (!removed) throw notFound();
    return reply.status(204).send();
  });

  // ---- Grants ----
  app.get('/me/grants', { schema: { tags: ['consent'], summary: 'Senior: all grants incl. history. Grantee: only own ACTIVE grants (no revokedAt).' } }, async (req) => {
    const u = requireUser(req);
    const owner = await requireOwner(db, u).catch(() => null);
    if (owner) {
      const rows = await db.select({ g: consentGrants, name: users.displayName }).from(consentGrants)
        .innerJoin(users, eq(users.id, consentGrants.granteeUserId))
        .where(eq(consentGrants.seniorId, u.id)).orderBy(desc(consentGrants.createdAt));
      return rows.map((r) => toGrantDTO(r.g, r.name, true));
    }
    const rows = await db.select({ g: consentGrants, name: users.displayName, memberRole: familyMemberships.role }).from(consentGrants)
      .innerJoin(users, eq(users.id, consentGrants.granteeUserId))
      .innerJoin(families, eq(families.seniorId, consentGrants.seniorId))
      .innerJoin(familyMemberships, and(eq(familyMemberships.familyId, families.id), eq(familyMemberships.userId, u.id), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')))
      .where(and(eq(consentGrants.granteeUserId, u.id), isNull(consentGrants.revokedAt), gt(consentGrants.expiresAt, new Date())))
      .orderBy(desc(consentGrants.createdAt));
    return rows
      .filter((r) => mayHoldCategory(u.role, r.memberRole, r.g.category))
      .map((r) => toGrantDTO(r.g, r.name, false));
  });

  app.post('/me/grants', { schema: { tags: ['consent'], summary: 'Create a grant (senior; step-up for checkins/scam_checks/transfer_pauses)', body: doc(createGrantReq) } }, async (req, reply) => {
    const { user, family } = await requireOwner(db, req.user);
    const b = createGrantReq.parse(req.body);
    if (STEP_UP_CATEGORIES.includes(b.category)) await requireStepUp(db, config, req, reply, b.password);
    const [m] = await db.select({ m: familyMemberships, role: users.role, name: users.displayName }).from(familyMemberships)
      .innerJoin(users, eq(users.id, familyMemberships.userId))
      .where(and(eq(familyMemberships.familyId, family.id), eq(familyMemberships.userId, b.granteeUserId), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')));
    if (!m) throw badRequest('INVALID_GRANTEE', 'This person is not a confirmed member of your circle');
    if (!mayHoldCategory(m.role, m.m.role, b.category)) throw forbidden('CAREGIVER_FORBIDDEN', 'Caregivers cannot receive this category');
    const now = Date.now();
    const expiresAt = b.expiresAt ? new Date(b.expiresAt) : new Date(now + 90 * DAY);
    if (expiresAt.getTime() <= now) throw badRequest('INVALID_EXPIRY', 'Expiry must be in the future');
    if (expiresAt.getTime() > now + 365 * DAY + 60_000) throw badRequest('INVALID_EXPIRY', 'Expiry can be at most 365 days away');
    const [existing] = await db.select({ id: consentGrants.id }).from(consentGrants).where(and(
      eq(consentGrants.seniorId, user.id), eq(consentGrants.granteeUserId, b.granteeUserId), eq(consentGrants.category, b.category),
      isNull(consentGrants.revokedAt), gt(consentGrants.expiresAt, new Date()),
    ));
    if (existing) throw conflict('GRANT_EXISTS', 'This is already shared with this person');
    const [g] = await db.insert(consentGrants).values({
      familyId: family.id, seniorId: user.id, granteeUserId: b.granteeUserId, category: b.category, createdBy: user.id, expiresAt, consentTextVersion: CONSENT_TEXT_VERSION,
    }).returning();
    await recordAudit(db, { actorId: user.id, seniorId: user.id, action: 'grant.created', targetType: 'grant', targetId: g!.id, meta: { category: b.category, grantee: b.granteeUserId } });
    return toGrantDTO(g!, m.name, true);
  });

  app.delete('/me/grants/:id', { schema: { tags: ['consent'], summary: 'Revoke a grant (senior)' } }, async (req) => {
    const { user } = await requireOwner(db, req.user);
    const { id } = idParam.parse(req.params);
    const [g] = await db.select({ g: consentGrants, name: users.displayName }).from(consentGrants)
      .innerJoin(users, eq(users.id, consentGrants.granteeUserId))
      .where(and(eq(consentGrants.id, id), eq(consentGrants.seniorId, user.id)));
    if (!g) throw notFound();
    if (g.g.revokedAt) return toGrantDTO(g.g, g.name, true);
    const updated = await db.transaction(async (tx) => {
      const [r] = await tx.update(consentGrants).set({ revokedAt: new Date() }).where(eq(consentGrants.id, id)).returning();
      await engine.onConsentRevoked(user.id, g.g.granteeUserId, [g.g.category], tx);
      await recordAudit(tx, { actorId: user.id, seniorId: user.id, action: 'grant.revoked', targetType: 'grant', targetId: id, meta: { category: g.g.category } });
      return r!;
    });
    return toGrantDTO(updated, g.name, true);
  });

  // ---- Access log ----
  app.get('/me/access-log', { schema: { tags: ['consent'], summary: 'Who viewed my info (senior)' } }, async (req) => {
    const { user } = await requireOwner(db, req.user);
    const rows = await db.select({ id: accessLogs.id, viewerName: users.displayName, category: accessLogs.category, at: accessLogs.at })
      .from(accessLogs).innerJoin(users, eq(users.id, accessLogs.viewerId))
      .where(eq(accessLogs.seniorId, user.id)).orderBy(desc(accessLogs.at)).limit(200);
    return rows.map(toAccessLogDTO);
  });
}
