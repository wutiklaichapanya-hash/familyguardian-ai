ALTER TABLE "audit_events" ADD COLUMN "seq" bigint;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "prev_hash" text;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_seq_uq" ON "audit_events" USING btree ("seq");
--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------------------------
-- SR-21 (partial): append-only hash chain on audit_events (hand-written below the drizzle-generated DDL).
-- canonical(row) = netstring-style fields, in this order: seq, id, at (UTC ISO, microseconds), actor_id, senior_id,
-- action, target_type, target_id, meta::text. Each field is `<utf8 byte length>:<value>,`; NULL is `~,`.
-- hash = hex(sha256(prev_hash || canonical)). Genesis prev_hash = 64 zeros.
-- Recomputed independently (in TypeScript) by `pnpm --filter @fg/api audit:verify`.
-- seq / prev_hash / hash are NOT NULL in the database but nullable in schema.ts so inserts never have to set them.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fg_audit_field(v text) RETURNS text AS $$
  SELECT CASE WHEN v IS NULL THEN '~,' ELSE octet_length(v)::text || ':' || v || ',' END;
$$ LANGUAGE sql IMMUTABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fg_audit_canonical(r audit_events) RETURNS text AS $$
  SELECT fg_audit_field(r.seq::text) || fg_audit_field(r.id::text)
      || fg_audit_field(to_char(r.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
      || fg_audit_field(r.actor_id::text) || fg_audit_field(r.senior_id::text) || fg_audit_field(r.action)
      || fg_audit_field(r.target_type) || fg_audit_field(r.target_id) || fg_audit_field(r.meta::text);
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fg_audit_events_chain() RETURNS trigger AS $$
DECLARE
  last_seq bigint;
  last_hash text;
BEGIN
  -- Serialise chain writers until commit so that seq order == chain order.
  PERFORM pg_advisory_xact_lock(724873001);
  SELECT seq, hash INTO last_seq, last_hash FROM audit_events WHERE seq IS NOT NULL ORDER BY seq DESC LIMIT 1;
  NEW.seq := coalesce(last_seq, 0) + 1;
  NEW.prev_hash := coalesce(last_hash, repeat('0', 64));
  NEW.hash := encode(sha256(convert_to(NEW.prev_hash || fg_audit_canonical(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- One-off backfill of existing rows in time order. The append-only trigger is paused ONLY inside this migration.
ALTER TABLE "audit_events" DISABLE TRIGGER audit_events_append_only;
--> statement-breakpoint
DO $$
DECLARE
  r audit_events;
  n bigint := 0;
  prev text := repeat('0', 64);
BEGIN
  FOR r IN SELECT * FROM audit_events ORDER BY at, id LOOP
    n := n + 1;
    r.seq := n;
    UPDATE audit_events SET seq = n, prev_hash = prev,
      hash = encode(sha256(convert_to(prev || fg_audit_canonical(r), 'UTF8')), 'hex')
      WHERE id = r.id RETURNING hash INTO prev;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE TRIGGER audit_events_append_only;
--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "seq" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "prev_hash" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "hash" SET NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_chain ON "audit_events";
--> statement-breakpoint
CREATE TRIGGER audit_events_chain BEFORE INSERT ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION fg_audit_events_chain();
