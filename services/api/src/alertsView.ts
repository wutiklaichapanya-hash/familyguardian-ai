import { inArray } from 'drizzle-orm';
import type { AlertDTO, Locale } from '@fg/shared';
import type { Db } from './db/client';
import { alerts, notifications, users } from './db/schema';
import { toAlertDTO, toDeliveryDTO } from './dto';

/** Build AlertDTOs. Senior (owner) sees every delivery; a recipient sees only their own. */
export async function buildAlertDTOs(db: Db, rows: (typeof alerts.$inferSelect)[], viewer: { id: string; locale: Locale }, asOwner: boolean): Promise<AlertDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((a) => a.id);
  const notes = await db.select().from(notifications).where(inArray(notifications.alertId, ids));
  const userIds = new Set<string>();
  for (const a of rows) { userIds.add(a.seniorId); if (a.acknowledgedBy) userIds.add(a.acknowledgedBy); }
  for (const n of notes) userIds.add(n.recipientId);
  const names = new Map((await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, [...userIds]))).map((u) => [u.id, u.name]));
  return rows.map((a) => {
    const deliveries = notes
      .filter((n) => n.alertId === a.id && (asOwner || n.recipientId === viewer.id))
      .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
      .map((n) => toDeliveryDTO(n, names.get(n.recipientId) ?? ''));
    return toAlertDTO(a, {
      seniorName: names.get(a.seniorId) ?? '', locale: viewer.locale, asOwner,
      ackName: a.acknowledgedBy ? names.get(a.acknowledgedBy) ?? null : null, deliveries,
    });
  });
}
