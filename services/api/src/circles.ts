import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { MeRes } from '@fg/shared';
import type { Db } from './db/client';
import { families, familyMemberships, users } from './db/schema';
import type { UserRow } from './app';
import { toUserDTO } from './dto';
import { forbidden, unauthorized } from './errors';

export async function circlesFor(db: Db, u: UserRow): Promise<MeRes['circles']> {
  const own = await db.select().from(families).where(eq(families.seniorId, u.id));
  if (own.length > 0) return own.map((f) => ({ familyId: f.id, seniorId: u.id, seniorName: u.displayName, relationship: 'self' }));
  if (u.role === 'admin' || u.role === 'org_admin') return [];
  const senior = alias(users, 'senior');
  const rows = await db.select({ familyId: families.id, seniorId: families.seniorId, seniorName: senior.displayName, relationship: familyMemberships.relationship })
    .from(familyMemberships)
    .innerJoin(families, eq(families.id, familyMemberships.familyId))
    .innerJoin(senior, eq(senior.id, families.seniorId))
    .where(and(eq(familyMemberships.userId, u.id), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')));
  return rows;
}

export async function meRes(db: Db, u: UserRow): Promise<MeRes> {
  return { user: toUserDTO(u), circles: await circlesFor(db, u) };
}

/** The family owned by a senior (seniors own exactly one family in the MVP). */
export async function familyOf(db: Db, seniorId: string) {
  const [f] = await db.select().from(families).where(eq(families.seniorId, seniorId)).limit(1);
  return f ?? null;
}

/** [senior]: the caller must OWN a family (ownership, not user.role). Else 403. */
export async function requireOwner(db: Db, u: UserRow | null) {
  if (!u) throw unauthorized();
  const f = await familyOf(db, u.id);
  if (!f) throw forbidden('SENIOR_ONLY', 'Only the senior who owns the family can do this');
  return { user: u, family: f };
}
