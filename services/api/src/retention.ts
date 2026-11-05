// Retention purge (v0.3; periods from docs/architecture/03_ARCHITECTURE.md §5, still PROPOSED pending DPO review).
//   - ScamShield raw submissions after 30 days: input text/url/phone nulled and evidence quotes stripped.
//     The risk level, signals, explanations and steps are kept.
//   - Guardian Pause sessions after 90 days: rows and their per-recipient shares are hard-deleted.
//   - Check-ins after 12 months: rows and any shares are hard-deleted.
//   - Sessions: expired (absolute), idle-expired, or revoked rows are deleted.
// One audit event per run with COUNTS ONLY (no ids, no content).
// Scheduled through pg-boss (PURGE_CRON, default daily 03:17) and runnable by hand: pnpm --filter @fg/api purge:run
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { and, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { createDb, type Db } from './db/client';
import { contentShares, guardianPauseSessions, scamAssessments, sessions, wellbeingCheckins } from './db/schema';
import { recordAudit } from './audit';
import { loadConfig, type AppConfig } from './config';

export type RetentionConfig = Pick<AppConfig, 'retentionScamTextDays' | 'retentionPauseDays' | 'retentionCheckinMonths' | 'sessionIdleHours'>;
export interface PurgeCounts {
  scamTextRedacted: number; pauseSessionsDeleted: number; checkinsDeleted: number; sharesDeleted: number; sessionsDeleted: number;
}

const DAY = 86_400_000;
function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export async function runRetentionPurge(db: Db, cfg: RetentionConfig, now = new Date()): Promise<PurgeCounts> {
  const scamCutoff = new Date(now.getTime() - cfg.retentionScamTextDays * DAY);
  const pauseCutoff = new Date(now.getTime() - cfg.retentionPauseDays * DAY);
  const checkinCutoff = monthsBefore(now, cfg.retentionCheckinMonths);
  const idleCutoff = new Date(now.getTime() - cfg.sessionIdleHours * 3_600_000);

  return db.transaction(async (tx) => {
    // 1. Scam raw text → null; strip `quote` from every evidence item (quotes are fragments of the raw text).
    const scam = await tx.update(scamAssessments).set({
      inputText: null, inputUrl: null, inputPhone: null,
      result: sql`jsonb_set(${scamAssessments.result}, '{evidence}', coalesce((select jsonb_agg(e - 'quote') from jsonb_array_elements(${scamAssessments.result}->'evidence') e), '[]'::jsonb))`,
    }).where(and(
      lt(scamAssessments.createdAt, scamCutoff),
      or(isNotNull(scamAssessments.inputText), isNotNull(scamAssessments.inputUrl), isNotNull(scamAssessments.inputPhone),
        sql`jsonb_path_exists(${scamAssessments.result}, '$.evidence[*].quote')`),
    )).returning({ id: scamAssessments.id });

    // 2. Guardian Pause sessions (+ shares).
    const pauses = await tx.delete(guardianPauseSessions).where(lt(guardianPauseSessions.createdAt, pauseCutoff)).returning({ id: guardianPauseSessions.id });
    // 3. Check-ins (+ shares).
    const checkins = await tx.delete(wellbeingCheckins).where(lt(wellbeingCheckins.createdAt, checkinCutoff)).returning({ id: wellbeingCheckins.id });
    let sharesDeleted = 0;
    if (pauses.length) {
      sharesDeleted += (await tx.delete(contentShares).where(and(sql`${contentShares.category} = 'transfer_pauses'`, inArray(contentShares.itemId, pauses.map((p) => p.id)))).returning({ id: contentShares.id })).length;
    }
    if (checkins.length) {
      sharesDeleted += (await tx.delete(contentShares).where(and(sql`${contentShares.category} = 'checkins'`, inArray(contentShares.itemId, checkins.map((c) => c.id)))).returning({ id: contentShares.id })).length;
    }

    // 4. Sessions that can never be used again.
    const sess = await tx.delete(sessions).where(or(lt(sessions.expiresAt, now), lt(sessions.lastSeenAt, idleCutoff), isNotNull(sessions.revokedAt))).returning({ id: sessions.id });

    const counts: PurgeCounts = {
      scamTextRedacted: scam.length, pauseSessionsDeleted: pauses.length, checkinsDeleted: checkins.length, sharesDeleted, sessionsDeleted: sess.length,
    };
    await recordAudit(tx, {
      action: 'retention.purge',
      meta: { ...counts, policy: { scamTextDays: cfg.retentionScamTextDays, pauseDays: cfg.retentionPauseDays, checkinMonths: cfg.retentionCheckinMonths } },
    });
    return counts;
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const cfg = loadConfig();
  const { db, close } = createDb(cfg.databaseUrl, { max: 1 });
  runRetentionPurge(db, cfg)
    .then((c) => { console.log(`retention purge done: ${JSON.stringify(c)}`); })
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => close());
}
