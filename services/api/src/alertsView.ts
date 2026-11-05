import { inArray } from 'drizzle-orm';
import type { AlertDTO, Locale } from '@fg/shared';
import type { Db } from './db/client';
import type { Actor, Policy } from './policy';
import { alerts, notifications, users } from './db/schema';
import { toAlertDTO, toDeliveryDTO } from './dto';

/**
 * Build AlertDTOs. Senior (owner) sees every delivery; a recipient sees only their own.
 * v0.3: `phone` (recipient view only) adds `seniorPhone` when the viewer holds an active 'contacts' grant
 * for that senior; the check is a policy 'read' and is access-logged. Absent otherwise.
 */
export async function buildAlertDTOs(
  db: Db, rows: (typeof alerts.$inferSelect)[], viewer: { id: string; locale: Locale }, asOwner: boolean,
  phone?: { policy: Policy; actor: Actor },
): Promise<AlertDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((a) => a.id);
  const notes = await db.select().from(notifications).where(inArray(notifications.alertId, ids));
  const userIds = new Set<string>();
  for (const a of rows) { userIds.add(a.seniorId); if (a.acknowledgedBy) userIds.add(a.acknowledgedBy); }
  for (const n of notes) userIds.add(n.recipientId);
  const people = await db.select({ id: users.id, name: users.displayName, phone: users.phone }).from(users).where(inArray(users.id, [...userIds]));
  const names = new Map(people.map((u) => [u.id, u.name]));
  const phones = new Map<string, string | null>(); // seniorId → phone, only for seniors the viewer may see contacts of
  if (!asOwner && phone) {
    for (const seniorId of new Set(rows.map((a) => a.seniorId))) {
      if ((await phone.policy.authorize(phone.actor, 'read', seniorId, 'contacts')).allowed) {
        phones.set(seniorId, people.find((p) => p.id === seniorId)?.phone ?? null);
      }
    }
  }
  return rows.map((a) => {
    const deliveries = notes
      .filter((n) => n.alertId === a.id && (asOwner || n.recipientId === viewer.id))
      .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
      .map((n) => toDeliveryDTO(n, names.get(n.recipientId) ?? ''));
    const dto = toAlertDTO(a, {
      seniorName: names.get(a.seniorId) ?? '', locale: viewer.locale, asOwner,
      ackName: a.acknowledgedBy ? names.get(a.acknowledgedBy) ?? null : null, deliveries,
    });
    return phones.has(a.seniorId) ? { ...dto, seniorPhone: phones.get(a.seniorId) ?? null } : dto;
  });
}
