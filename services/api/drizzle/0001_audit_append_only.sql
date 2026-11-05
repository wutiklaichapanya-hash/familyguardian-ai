-- AuditEvents are append-only: reject UPDATE and DELETE at the database level.
-- (TRUNCATE is still possible for the SYNTHETIC demo reset / test reset only.)
CREATE OR REPLACE FUNCTION fg_audit_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% rejected)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_append_only ON "audit_events";
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION fg_audit_events_append_only();
