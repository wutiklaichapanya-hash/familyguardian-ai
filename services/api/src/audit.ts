// AuditEvents are append-only. This module deliberately exposes NO update or delete.
import { auditEvents } from './db/schema';
import type { Tx } from './db/client';

export interface AuditInput {
  actorId?: string | null;
  seniorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Metadata only — never personal content (no notes, messages, scam text, phone numbers). */
  meta?: Record<string, unknown>;
}

export async function recordAudit(db: Tx, e: AuditInput): Promise<void> {
  await db.insert(auditEvents).values({
    actorId: e.actorId ?? null,
    seniorId: e.seniorId ?? null,
    action: e.action,
    targetType: e.targetType ?? null,
    targetId: e.targetId ?? null,
    meta: e.meta ?? null,
  });
}
