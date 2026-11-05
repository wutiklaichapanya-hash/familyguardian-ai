// THE authorisation module. Every read or write of senior-owned data goes through `authorize`.
// Model: RBAC (role) + relationship (active family membership) + ConsentGrant (category, expiry, revocation).
//
// Rules (see README "Policy summary"):
//  - A senior may do anything with their own data. Only the senior may create/revoke grants.
//  - Anyone else needs: an active membership in the senior's family AND an active grant
//    (not revoked, not expired) for the exact category.
//  - Caregivers can NEVER use CAREGIVER_FORBIDDEN categories, even if a grant row somehow exists.
//  - Admin (and org_admin) can never read or receive senior content (check-ins, notes, scam text, pauses...).
//  - Every successful 'read' by someone other than the senior writes an access-log row (deduped per viewer × category × day).
//  - Denied reads return 404 (never reveal existence or revocation); denied own-scope writes return 403.
//  - "Senior" = the user who OWNS the family (families.senior_id), not merely user.role.
//  - Members are only effective once the senior confirmed them (membership.status = 'active').
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { ALERT_KIND_CATEGORY, CAREGIVER_FORBIDDEN, type AlertKind, type Role, type ShareCategory } from '@fg/shared';
import type { Db, Tx } from './db/client';
import { accessLogs, consentGrants, contentShares, families, familyMemberships, notifications, users } from './db/schema';
import { badRequest, forbidden, notFound } from './errors';

export interface Actor { userId: string; role: Role }

export type PolicyAction =
  | 'read'          // view shared content of a category
  | 'notify'        // be the recipient of a notification in a category (checked at enqueue AND delivery)
  | 'write'         // create/modify senior-owned content
  | 'manage_grants' // create/revoke grants, invitations, membership
  | 'admin_ops';    // operational admin endpoints (counts only)

export type Decision =
  | { allowed: true; via: 'self' | 'grant' | 'admin'; grantId?: string }
  | { allowed: false; code: string; reason: string };

const CONTENT_DENIED_ROLES: readonly Role[] = ['admin', 'org_admin'];

export const isCaregiverForbidden = (category: ShareCategory) => CAREGIVER_FORBIDDEN.includes(category);

/** Whether a member with these roles may hold `category` at all. */
export function mayHoldCategory(userRole: Role, memberRole: 'family' | 'caregiver', category: ShareCategory): boolean {
  if (CONTENT_DENIED_ROLES.includes(userRole) || userRole === 'senior') return false;
  if ((userRole === 'caregiver' || memberRole === 'caregiver') && isCaregiverForbidden(category)) return false;
  return true;
}

export class Policy {
  constructor(private db: Db, private now: () => Date = () => new Date()) {}

  async authorize(actor: Actor, action: PolicyAction, seniorId: string | null, category: ShareCategory | null, tx: Tx = this.db): Promise<Decision> {
    if (action === 'admin_ops') {
      return actor.role === 'admin'
        ? { allowed: true, via: 'admin' }
        : { allowed: false, code: 'FORBIDDEN', reason: 'Admin only' };
    }
    if (CONTENT_DENIED_ROLES.includes(actor.role)) {
      return { allowed: false, code: 'ADMIN_NO_CONTENT', reason: 'Operators cannot access personal content' };
    }
    if (!seniorId) return { allowed: false, code: 'FORBIDDEN', reason: 'No subject' };

    if (actor.userId === seniorId) {
      const [own] = await tx.select({ id: families.id }).from(families).where(eq(families.seniorId, seniorId)).limit(1);
      return own
        ? { allowed: true, via: 'self' }
        : { allowed: false, code: 'SENIOR_ONLY', reason: 'Only the senior who owns the family can do this' };
    }
    // Only the senior writes their own data or manages sharing.
    if (action === 'write' || action === 'manage_grants') {
      return { allowed: false, code: 'SENIOR_ONLY', reason: 'Only the senior can do this' };
    }
    if (!category) return { allowed: false, code: 'FORBIDDEN', reason: 'No category' };

    const membership = await this.activeMembership(actor.userId, seniorId, tx);
    if (!membership) return { allowed: false, code: 'NOT_A_MEMBER', reason: 'Not in this family circle' };
    if (!mayHoldCategory(actor.role, membership.role, category)) {
      return { allowed: false, code: 'CAREGIVER_FORBIDDEN', reason: 'Caregivers cannot access this category' };
    }
    const now = this.now();
    const [grant] = await tx.select({ id: consentGrants.id }).from(consentGrants).where(and(
      eq(consentGrants.seniorId, seniorId),
      eq(consentGrants.granteeUserId, actor.userId),
      eq(consentGrants.category, category),
      isNull(consentGrants.revokedAt),
      gt(consentGrants.expiresAt, now),
    )).limit(1);
    if (!grant) return { allowed: false, code: 'NO_CONSENT', reason: 'Not shared with you' };

    if (action === 'read') {
      await tx.insert(accessLogs).values({ seniorId, viewerId: actor.userId, category, day: now.toISOString().slice(0, 10), at: now })
        .onConflictDoUpdate({ target: [accessLogs.seniorId, accessLogs.viewerId, accessLogs.category, accessLogs.day], set: { at: now } });
    }
    return { allowed: true, via: 'grant', grantId: grant.id };
  }

  /** authorize() that throws on denial: 404 for read/notify (no existence/revocation leak), 403 for own-scope writes. */
  async assert(actor: Actor, action: PolicyAction, seniorId: string | null, category: ShareCategory | null, tx: Tx = this.db): Promise<Decision & { allowed: true }> {
    const d = await this.authorize(actor, action, seniorId, category, tx);
    if (!d.allowed) {
      if (action === 'read' || action === 'notify') throw notFound();
      throw forbidden(d.code, d.reason);
    }
    return d;
  }

  /** Categories the actor may read right now for this senior (no access-log rows written). */
  async visibleCategories(actor: Actor, seniorId: string, categories: readonly ShareCategory[], tx: Tx = this.db): Promise<ShareCategory[]> {
    const out: ShareCategory[] = [];
    for (const c of categories) {
      const d = await this.authorize(actor, 'notify', seniorId, c, tx);
      if (d.allowed) out.push(c);
    }
    return out;
  }

  /** Users currently permitted to receive notifications in `category` about `seniorId`, ordered by join date. */
  async permittedRecipients(seniorId: string, category: ShareCategory, tx: Tx = this.db): Promise<{ userId: string; role: Role; displayName: string; locale: 'th' | 'en' }[]> {
    const rows = await tx.select({ userId: familyMemberships.userId, role: users.role, displayName: users.displayName, locale: users.locale })
      .from(familyMemberships)
      .innerJoin(families, eq(families.id, familyMemberships.familyId))
      .innerJoin(users, eq(users.id, familyMemberships.userId))
      .where(and(eq(families.seniorId, seniorId), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')))
      .orderBy(asc(familyMemberships.joinedAt));
    const out = [];
    for (const r of rows) {
      const d = await this.authorize({ userId: r.userId, role: r.role }, 'notify', seniorId, category, tx);
      if (d.allowed) out.push(r);
    }
    return out;
  }

  async activeMembership(userId: string, seniorId: string, tx: Tx = this.db) {
    const [m] = await tx.select({ id: familyMemberships.id, role: familyMemberships.role, relationship: familyMemberships.relationship, familyId: familyMemberships.familyId })
      .from(familyMemberships)
      .innerJoin(families, eq(families.id, familyMemberships.familyId))
      .where(and(eq(families.seniorId, seniorId), eq(familyMemberships.userId, userId), isNull(familyMemberships.removedAt), eq(familyMemberships.status, 'active')))
      .limit(1);
    return m ?? null;
  }

  /** Share check (SR-04): every recipient must be a confirmed member with an active matching grant and not a caregiver.
   *  Throws ONE generic 400 that says nothing about which user failed or why. */
  async assertAllPermitted(seniorId: string, category: ShareCategory, userIds: string[], tx: Tx = this.db): Promise<void> {
    const generic = badRequest('SHARE_NOT_ALLOWED', 'One or more selected people cannot receive this');
    const unique = [...new Set(userIds)];
    if (unique.length === 0) throw generic;
    const rows = await tx.select({ id: users.id, role: users.role }).from(users).where(inArray(users.id, unique));
    if (rows.length !== unique.length) throw generic;
    for (const r of rows) {
      if (r.id === seniorId) throw generic;
      const m = await this.activeMembership(r.id, seniorId, tx);
      if (!m || m.role === 'caregiver' || r.role === 'caregiver') throw generic;
      const d = await this.authorize({ userId: r.id, role: r.role }, 'notify', seniorId, category, tx);
      if (!d.allowed) throw generic;
    }
  }

  /** Is `itemId` (scam check / pause) shared with this user? Re-checked on every read (SR-04). */
  async isSharedWith(category: ShareCategory, itemId: string, userId: string, tx: Tx = this.db): Promise<boolean> {
    const [r] = await tx.select({ id: contentShares.id }).from(contentShares)
      .where(and(eq(contentShares.category, category), eq(contentShares.itemId, itemId), eq(contentShares.userId, userId))).limit(1);
    return !!r;
  }

  /**
   * Alert visibility for a non-owner (read/ack): the grant mapped by ALERT_KIND_CATEGORY must be active, the viewer must
   * have been a recipient, and for shared items the item must still be shared with them. Writes an access-log row.
   */
  async canSeeAlert(actor: Actor, alert: { id: string; seniorId: string; kind: AlertKind; sourceId: string | null }, tx: Tx = this.db): Promise<boolean> {
    if (actor.userId === alert.seniorId) return (await this.authorize(actor, 'read', alert.seniorId, ALERT_KIND_CATEGORY[alert.kind], tx)).allowed;
    const [mine] = await tx.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.alertId, alert.id), eq(notifications.recipientId, actor.userId))).limit(1);
    if (!mine) return false;
    const category = ALERT_KIND_CATEGORY[alert.kind];
    if (alert.sourceId && (category === 'scam_checks' || category === 'transfer_pauses')) {
      if (!(await this.isSharedWith(category, alert.sourceId, actor.userId, tx))) return false;
    }
    return (await this.authorize(actor, 'read', alert.seniorId, category, tx)).allowed;
  }
}
