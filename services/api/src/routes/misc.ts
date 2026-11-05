import type { FastifyInstance } from 'fastify';
import { and, asc, count, eq, gte } from 'drizzle-orm';
import { NOTIFICATION_STATES, ROLES, type AdminOverviewDTO, type NotificationState, type Role } from '@fg/shared';
import { type Ctx, actorOf, requireUser } from '../app';
import { directoryEntries, families, notifications, users } from '../db/schema';
import { recordAudit } from '../audit';
import { toDirectoryDTO } from '../dto';
import { directoryQuery } from '../validation';

export default async function miscRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, policy } = ctx;

  // Public (no session): official numbers only, used by the logged-out emergency page (SR-15).
  app.get('/directory', { schema: { tags: ['directory'], summary: 'Help directory (public, no session needed)', security: [] } }, async (req) => {
    const { country } = directoryQuery.parse(req.query);
    const rows = await db.select().from(directoryEntries).where(eq(directoryEntries.country, country)).orderBy(asc(directoryEntries.sortOrder));
    return rows.map(toDirectoryDTO);
  });

  // Operational counts only — never personal content (no check-ins, notes, scam text, pauses).
  app.get('/admin/overview', { schema: { tags: ['admin'], summary: 'Operational overview (admin only; counts only)' } }, async (req): Promise<AdminOverviewDTO> => {
    const u = requireUser(req);
    await policy.assert(actorOf(u), 'admin_ops', null, null);
    const byRole = await db.select({ role: users.role, n: count() }).from(users).groupBy(users.role);
    const byState = await db.select({ state: notifications.state, n: count() }).from(notifications).groupBy(notifications.state);
    const [fam] = await db.select({ n: count() }).from(families);
    const [failed] = await db.select({ n: count() }).from(notifications)
      .where(and(eq(notifications.state, 'failed'), gte(notifications.updatedAt, new Date(Date.now() - 86_400_000))));
    const [unverified] = await db.select({ n: count() }).from(directoryEntries).where(eq(directoryEntries.verification, 'needs_human_verification'));
    const usersCount = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
    for (const r of byRole) usersCount[r.role] = Number(r.n);
    const notif = Object.fromEntries(NOTIFICATION_STATES.map((s) => [s, 0])) as Record<NotificationState, number>;
    for (const r of byState) notif[r.state] = Number(r.n);
    await recordAudit(db, { actorId: u.id, action: 'admin.overview_viewed' });
    return {
      users: usersCount, families: Number(fam?.n ?? 0), notifications: notif,
      failedDeliveriesLast24h: Number(failed?.n ?? 0), directoryUnverified: Number(unverified?.n ?? 0), generatedAt: new Date().toISOString(),
    };
  });
}
