CREATE TYPE "public"."action_log_kind" AS ENUM('call_started_from_app', 'help_request_sent', 'alert_acknowledged');--> statement-breakpoint
CREATE TYPE "public"."alert_kind" AS ENUM('user_requested_help', 'shared_scam_check', 'shared_transfer_pause', 'shared_checkin_concern');--> statement-breakpoint
CREATE TYPE "public"."alert_origin" AS ENUM('system_warning', 'user_requested');--> statement-breakpoint
CREATE TYPE "public"."directory_kind" AS ENUM('medical_emergency', 'police', 'anti_scam', 'bank_fraud', 'social_support');--> statement-breakpoint
CREATE TYPE "public"."directory_verification" AS ENUM('verified', 'needs_human_verification');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'pending_confirmation', 'confirmed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('family', 'caregiver');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pending_confirmation', 'active');--> statement-breakpoint
CREATE TYPE "public"."mood" AS ENUM('happy', 'okay', 'lonely', 'worried', 'tired', 'prefer_not_to_answer');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push_simulated', 'email_simulated');--> statement-breakpoint
CREATE TYPE "public"."notification_state" AS ENUM('queued', 'sent', 'failed', 'seen', 'acknowledged', 'cancelled_no_consent');--> statement-breakpoint
CREATE TYPE "public"."pause_level" AS ENUM('proceed_with_care', 'stop_and_verify');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low_signals', 'caution', 'high_risk', 'cannot_assess');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('senior', 'family', 'caregiver', 'admin', 'org_admin');--> statement-breakpoint
CREATE TYPE "public"."share_category" AS ENUM('checkins', 'help_requests', 'scam_checks', 'transfer_pauses', 'care_tasks', 'contacts');--> statement-breakpoint
CREATE TABLE "access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"viewer_id" uuid NOT NULL,
	"category" "share_category" NOT NULL,
	"day" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "action_log_kind" NOT NULL,
	"label" text NOT NULL,
	"target" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"kind" "alert_kind" NOT NULL,
	"origin" "alert_origin" NOT NULL,
	"category" "share_category" NOT NULL,
	"summary" text NOT NULL,
	"senior_message" text,
	"source_id" uuid,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"senior_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "consent_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"senior_id" uuid NOT NULL,
	"grantee_user_id" uuid NOT NULL,
	"category" "share_category" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"consent_text_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"category" "share_category" NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"purpose_th" text NOT NULL,
	"purpose_en" text NOT NULL,
	"phone" text NOT NULL,
	"kind" "directory_kind" NOT NULL,
	"verification" "directory_verification" DEFAULT 'needs_human_verification' NOT NULL,
	"source_url" text,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"senior_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"relationship" text NOT NULL,
	"status" "membership_status" DEFAULT 'pending_confirmation' NOT NULL,
	"invitation_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guardian_pause_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"amount_thb" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"recipient_note" text,
	"level" "pause_level" NOT NULL,
	"reasons" jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"senior_id" uuid NOT NULL,
	"invitee_name" text NOT NULL,
	"relationship" text NOT NULL,
	"role" "member_role" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid,
	"senior_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"category" "share_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"state" "notification_state" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"is_follow_up" boolean DEFAULT false NOT NULL,
	"content_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" text NOT NULL,
	"subscription_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scam_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"input_text" text,
	"input_url" text,
	"input_phone" text,
	"locale" text,
	"risk" "risk_level" NOT NULL,
	"result" jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"payer_user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"provider" text DEFAULT 'sandbox' NOT NULL,
	"canceled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"last_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"phone" text NOT NULL,
	"linked_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"polite_particle" text DEFAULT 'ka' NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wellbeing_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"mood" "mood" NOT NULL,
	"note" text,
	"note_shared" boolean DEFAULT false NOT NULL,
	"only_me" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_grantee_user_id_users_id_fk" FOREIGN KEY ("grantee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_shares" ADD CONSTRAINT "content_shares_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_shares" ADD CONSTRAINT "content_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_pause_sessions" ADD CONSTRAINT "guardian_pause_sessions_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scam_assessments" ADD CONSTRAINT "scam_assessments_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellbeing_checkins" ADD CONSTRAINT "wellbeing_checkins_senior_id_users_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_logs_senior_idx" ON "access_logs" USING btree ("senior_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "access_logs_day_uq" ON "access_logs" USING btree ("senior_id","viewer_id","category","day");--> statement-breakpoint
CREATE INDEX "action_logs_user_idx" ON "action_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "alerts_senior_idx" ON "alerts" USING btree ("senior_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_senior_idx" ON "audit_events" USING btree ("senior_id","at");--> statement-breakpoint
CREATE INDEX "grants_lookup_idx" ON "consent_grants" USING btree ("senior_id","grantee_user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "content_shares_uq" ON "content_shares" USING btree ("category","item_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "directory_country_phone_uq" ON "directory_entries" USING btree ("country","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "families_senior_uq" ON "families" USING btree ("senior_id");--> statement-breakpoint
CREATE INDEX "memberships_family_idx" ON "family_memberships" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "family_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pause_senior_idx" ON "guardian_pause_sessions" USING btree ("senior_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_uq" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_alert_idx" ON "notifications" USING btree ("alert_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_uq" ON "payment_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "scam_senior_idx" ON "scam_assessments" USING btree ("senior_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_family_idx" ON "subscriptions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "contacts_senior_idx" ON "trusted_contacts" USING btree ("senior_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "checkins_senior_idx" ON "wellbeing_checkins" USING btree ("senior_id","created_at");