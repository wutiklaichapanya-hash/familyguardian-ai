// Database schema (Drizzle). Entities follow docs/architecture/03_ARCHITECTURE.md §5.
// Migrations are generated with `pnpm --filter @fg/api db:generate` into ./drizzle and applied by src/db/migrate.ts.
import {
  boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import {
  ALERT_KINDS, MOODS, NOTIFICATION_CHANNELS, NOTIFICATION_STATES, RISK_LEVELS, ROLES, SHARE_CATEGORIES, ACTION_LOG_KINDS,
} from '@fg/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => uuid('id').primaryKey().defaultRandom();

export const roleEnum = pgEnum('role', ROLES);
export const shareCategoryEnum = pgEnum('share_category', SHARE_CATEGORIES);
export const moodEnum = pgEnum('mood', MOODS);
export const riskEnum = pgEnum('risk_level', RISK_LEVELS);
export const alertKindEnum = pgEnum('alert_kind', ALERT_KINDS);
export const alertOriginEnum = pgEnum('alert_origin', ['system_warning', 'user_requested']);
export const notificationStateEnum = pgEnum('notification_state', NOTIFICATION_STATES);
export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const actionLogKindEnum = pgEnum('action_log_kind', ACTION_LOG_KINDS);
export const memberRoleEnum = pgEnum('member_role', ['family', 'caregiver']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'pending_confirmation', 'confirmed', 'cancelled', 'expired']);
export const membershipStatusEnum = pgEnum('membership_status', ['pending_confirmation', 'active']);
export const directoryKindEnum = pgEnum('directory_kind', ['medical_emergency', 'police', 'anti_scam', 'bank_fraud', 'social_support']);
export const directoryVerificationEnum = pgEnum('directory_verification', ['verified', 'needs_human_verification']);
export const pauseLevelEnum = pgEnum('pause_level', ['proceed_with_care', 'stop_and_verify']);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: roleEnum('role').notNull(),
  locale: text('locale').$type<'th' | 'en'>().notNull().default('th'),
  politeParticle: text('polite_particle').$type<'ka' | 'krap'>().notNull().default('ka'),
  isSynthetic: boolean('is_synthetic').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  deletedAt: ts('deleted_at'),
}, (t) => [uniqueIndex('users_email_uq').on(t.email)]);

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
}, (t) => [uniqueIndex('sessions_token_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)]);

export const families = pgTable('families', {
  id: id(),
  name: text('name').notNull(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('families_senior_uq').on(t.seniorId)]);

export const familyMemberships = pgTable('family_memberships', {
  id: id(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull(),
  relationship: text('relationship').notNull(),
  /** 'pending_confirmation' until the senior confirms (step-up). Pending members see nothing. */
  status: membershipStatusEnum('status').notNull().default('pending_confirmation'),
  invitationId: uuid('invitation_id'),
  joinedAt: ts('joined_at').notNull().defaultNow(),
  confirmedAt: ts('confirmed_at'),
  removedAt: ts('removed_at'),
}, (t) => [index('memberships_family_idx').on(t.familyId), index('memberships_user_idx').on(t.userId)]);

export const consentGrants = pgTable('consent_grants', {
  id: id(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  granteeUserId: uuid('grantee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: shareCategoryEnum('category').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
  consentTextVersion: text('consent_text_version').notNull(),
}, (t) => [index('grants_lookup_idx').on(t.seniorId, t.granteeUserId, t.category)]);

export const invitations = pgTable('invitations', {
  id: id(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeName: text('invitee_name').notNull(),
  relationship: text('relationship').notNull(),
  role: memberRoleEnum('role').notNull(),
  /** SHA-256 of the 128-bit secret part of the invite token. The plain token is returned once. */
  tokenHash: text('token_hash').notNull(),
  status: inviteStatusEnum('status').notNull().default('pending'),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  acceptedAt: ts('accepted_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('invitations_token_uq').on(t.tokenHash)]);

export const trustedContacts = pgTable('trusted_contacts', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  relationship: text('relationship').notNull(),
  phone: text('phone').notNull(),
  linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('contacts_senior_idx').on(t.seniorId)]);

export const wellbeingCheckins = pgTable('wellbeing_checkins', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mood: moodEnum('mood').notNull(),
  note: text('note'),
  noteShared: boolean('note_shared').notNull().default(false),
  onlyMe: boolean('only_me').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('checkins_senior_idx').on(t.seniorId, t.createdAt)]);

export const scamAssessments = pgTable('scam_assessments', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Raw submission. Returned ONLY to the senior. Retention: 30 days (purge job P1). */
  inputText: text('input_text'),
  inputUrl: text('input_url'),
  inputPhone: text('input_phone'),
  locale: text('locale').$type<'th' | 'en'>(),
  risk: riskEnum('risk').notNull(),
  /** Full assessment payload (evidence, explanation, uncertainty, steps, engine). */
  result: jsonb('result').notNull(),
  shared: boolean('shared').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('scam_senior_idx').on(t.seniorId, t.createdAt)]);

export const guardianPauseSessions = pgTable('guardian_pause_sessions', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amountThb: integer('amount_thb').notNull(),
  answers: jsonb('answers').notNull(),
  recipientNote: text('recipient_note'),
  level: pauseLevelEnum('level').notNull(),
  reasons: jsonb('reasons').notNull(),
  shared: boolean('shared').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('pause_senior_idx').on(t.seniorId, t.createdAt)]);

/** Which users a scam check / pause was shared with (the senior picks recipients). */
export const contentShares = pgTable('content_shares', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: shareCategoryEnum('category').notNull(),
  itemId: uuid('item_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('content_shares_uq').on(t.category, t.itemId, t.userId)]);

export const alerts = pgTable('alerts', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: alertKindEnum('kind').notNull(),
  origin: alertOriginEnum('origin').notNull(),
  category: shareCategoryEnum('category').notNull(),
  /** Minimal, non-sensitive summary shown to recipients. */
  summary: text('summary').notNull(),
  /** Optional message typed by the senior. Shown back only to the senior; never put in notifications. */
  seniorMessage: text('senior_message'),
  sourceId: uuid('source_id'),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  acknowledgedAt: ts('acknowledged_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('alerts_senior_idx').on(t.seniorId, t.createdAt)]);

export const notifications = pgTable('notifications', {
  id: id(),
  alertId: uuid('alert_id').references(() => alerts.id, { onDelete: 'cascade' }),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: shareCategoryEnum('category').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  state: notificationStateEnum('state').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  isFollowUp: boolean('is_follow_up').notNull().default(false),
  contentRevoked: boolean('content_revoked').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  sentAt: ts('sent_at'),
  seenAt: ts('seen_at'),
  acknowledgedAt: ts('acknowledged_at'),
}, (t) => [index('notifications_recipient_idx').on(t.recipientId, t.createdAt), index('notifications_alert_idx').on(t.alertId)]);

export const actionLogs = pgTable('action_logs', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: actionLogKindEnum('kind').notNull(),
  label: text('label').notNull(),
  target: text('target'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('action_logs_user_idx').on(t.userId, t.createdAt)]);

export const accessLogs = pgTable('access_logs', {
  id: id(),
  seniorId: uuid('senior_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewerId: uuid('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: shareCategoryEnum('category').notNull(),
  /** UTC day (YYYY-MM-DD): one row per viewer × category × day (SR-22 dedupe). `at` = latest view. */
  day: text('day').notNull(),
  at: ts('at').notNull().defaultNow(),
}, (t) => [index('access_logs_senior_idx').on(t.seniorId, t.at), uniqueIndex('access_logs_day_uq').on(t.seniorId, t.viewerId, t.category, t.day)]);

export const directoryEntries = pgTable('directory_entries', {
  id: id(),
  country: text('country').notNull(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en').notNull(),
  purposeTh: text('purpose_th').notNull(),
  purposeEn: text('purpose_en').notNull(),
  phone: text('phone').notNull(),
  kind: directoryKindEnum('kind').notNull(),
  verification: directoryVerificationEnum('verification').notNull().default('needs_human_verification'),
  sourceUrl: text('source_url'),
  verifiedBy: text('verified_by'),
  verifiedAt: ts('verified_at'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [uniqueIndex('directory_country_phone_uq').on(t.country, t.phone)]);

/** Append-only. Application code only INSERTs; a DB trigger rejects UPDATE/DELETE. */
export const auditEvents = pgTable('audit_events', {
  id: id(),
  at: ts('at').notNull().defaultNow(),
  actorId: uuid('actor_id'),
  seniorId: uuid('senior_id'),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  meta: jsonb('meta'),
}, (t) => [index('audit_senior_idx').on(t.seniorId, t.at)]);

// ---- P1 billing (sandbox) ----
/** Subscription per family (payer may be any member). Ids come from the provider (e.g. sbx_sub_...). */
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  payerUserId: uuid('payer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull(),
  status: text('status').notNull(),
  currentPeriodEnd: ts('current_period_end').notNull(),
  provider: text('provider').notNull().default('sandbox'),
  canceledAt: ts('canceled_at'),
  refundedAt: ts('refunded_at'),
  lastEventId: text('last_event_id'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [index('subscriptions_family_idx').on(t.familyId)]);

/** Processed provider events; the unique constraint on provider_event_id makes webhooks idempotent. */
export const paymentEvents = pgTable('payment_events', {
  id: id(),
  providerEventId: text('provider_event_id').notNull(),
  subscriptionId: text('subscription_id'),
  type: text('type').notNull(),
  /** Metadata only (no card data ever reaches us). */
  payload: jsonb('payload').notNull(),
  receivedAt: ts('received_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('payment_events_provider_uq').on(t.providerEventId)]);
