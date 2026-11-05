// SR-21 (partial): independent verifier for the audit_events hash chain.
// The chain is written by the DB trigger fg_audit_events_chain (drizzle/0002_v03_phone_audit_chain.sql).
// This module recomputes every hash in TypeScript from the stored columns and reports any break.
// Usage: pnpm --filter @fg/api audit:verify   (exit code 1 when the chain is broken)
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { createDb, type Db } from './db/client';

export const GENESIS_HASH = '0'.repeat(64);

export interface ChainBreak { seq: number; id: string; reason: 'seq_gap' | 'prev_hash_mismatch' | 'hash_mismatch' }
export interface ChainReport { ok: boolean; checked: number; lastSeq: number | null; breaks: ChainBreak[] }

type Row = {
  seq: string; id: string; at: string; actor_id: string | null; senior_id: string | null; action: string;
  target_type: string | null; target_id: string | null; meta: string | null; prev_hash: string; hash: string;
};

/** `<utf8 byte length>:<value>,`; NULL → `~,` (must match fg_audit_field in SQL). */
const field = (v: string | null) => (v === null ? '~,' : `${Buffer.byteLength(v, 'utf8')}:${v},`);

export function canonical(r: Omit<Row, 'prev_hash' | 'hash'>): string {
  return [r.seq, r.id, r.at, r.actor_id, r.senior_id, r.action, r.target_type, r.target_id, r.meta].map(field).join('');
}
export const chainHash = (prevHash: string, canon: string) => createHash('sha256').update(prevHash + canon, 'utf8').digest('hex');

export async function verifyAuditChain(db: Db): Promise<ChainReport> {
  // Columns are read as text with the same formatting the trigger uses; the hashing happens here, not in SQL.
  const rows = [...(await db.execute<Row>(sql`
    select seq::text as seq, id::text as id,
           to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at,
           actor_id::text as actor_id, senior_id::text as senior_id, action, target_type, target_id,
           meta::text as meta, prev_hash, hash
      from audit_events order by seq`))];
  const breaks: ChainBreak[] = [];
  let prevHash = GENESIS_HASH;
  let prevSeq = 0;
  for (const r of rows) {
    const seq = Number(r.seq);
    if (seq !== prevSeq + 1) breaks.push({ seq, id: r.id, reason: 'seq_gap' });
    if (r.prev_hash !== prevHash) breaks.push({ seq, id: r.id, reason: 'prev_hash_mismatch' });
    if (chainHash(r.prev_hash, canonical(r)) !== r.hash) breaks.push({ seq, id: r.id, reason: 'hash_mismatch' });
    prevHash = r.hash;
    prevSeq = seq;
  }
  return { ok: breaks.length === 0, checked: rows.length, lastSeq: rows.length ? prevSeq : null, breaks };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
  const { db, close } = createDb(url, { max: 1 });
  verifyAuditChain(db)
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      console.log(r.ok ? `audit chain OK (${r.checked} events)` : `audit chain BROKEN: ${r.breaks.length} problem(s)`);
      if (!r.ok) process.exitCode = 1;
    })
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => close());
}
