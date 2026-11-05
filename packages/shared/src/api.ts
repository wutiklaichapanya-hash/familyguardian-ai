// HTTP API contract between services/api and apps/web. Base path: /api/v1
// Auth: httpOnly session cookie `fg_session`. Every mutating request MUST send header `x-fg-csrf: 1`
// (custom-header CSRF defence; API CORS allows only WEB_ORIGIN with credentials).
// Errors: { error: { code: string; message: string } } with proper HTTP status (400/401/403/404/409/429).
// CONTRACT v0.2 (2026-11-05) — security review SR-01..SR-13 applied. Change only with lead approval.
//
// GLOBAL RULES (v0.2):
// - IDs are UUIDv4. A resource the caller may not see returns 404 (never 403-vs-404 differences
//   that reveal existence or revocation) (SR-07, SR-13). Role violations on own-scope writes return 403.
// - "[senior]" = caller must be the senior who OWNS the family (membership role check, not user.role) (SR-05).
// - "[step-up]" = body must include `password` (current password re-entered) (SR-11).
// - Every read of another person's data re-checks an active grant at read time AND writes an access-log row (SR-22).
// - `days` query params are capped at 90.
// - Grantees never see grant metadata of other members, revocation timestamps, onlyMe items, or counts of hidden items.

import type {
  AlertKind, AlertOrigin, AmountBucket, DashboardStatus, DirectoryVerification, Mood, NotificationChannel,
  NotificationState, RiskLevel, Role, ScamSignal, ShareCategory,
} from './domain';
import type { Locale } from './labels';

export type ISODate = string;

// ---------- Auth ----------
// POST   /auth/login        body LoginReq            -> MeRes   (also needs x-fg-csrf; no account enumeration in errors)
// POST   /auth/logout                                -> 204     (sends Clear-Site-Data: "cache", "storage")
// GET    /auth/me                                    -> MeRes
// GET    /auth/sessions                              -> SessionDTO[]   (own signed-in devices)
// DELETE /auth/sessions/:id                          -> 204
// Sessions: idle timeout 12h (remember-device: 30d absolute), rotate token on login and step-up.
export interface LoginReq { email: string; password: string }
export interface SessionDTO { id: string; current: boolean; userAgent: string; createdAt: ISODate; lastSeenAt: ISODate }
export interface UserDTO { id: string; email: string; displayName: string; role: Role; locale: Locale; politeParticle: 'ka' | 'krap' }
export interface MeRes {
  user: UserDTO;
  /** For family/caregiver: the seniors whose circle they belong to. For senior: their own family id. */
  circles: { familyId: string; seniorId: string; seniorName: string; relationship: string }[];
}

// ---------- Check-ins (Module B) ----------
// POST /me/checkins                      body CreateCheckinReq -> CheckinDTO   [senior]
// GET  /me/checkins?days=30                                    -> CheckinDTO[] (own)
// GET  /seniors/:seniorId/checkins?days=30                     -> SharedCheckinDTO[] ('checkins' grant; onlyMe rows EXCLUDED IN SQL;
//                                                                 note present only if noteShared; no onlyMe/noteShared flags) (SR-02)
export interface CreateCheckinReq { mood: Mood; note?: string; noteShared?: boolean; onlyMe?: boolean }
export interface SharedCheckinDTO { id: string; mood: Mood; note?: string; createdAt: ISODate }
export interface CheckinDTO { id: string; mood: Mood; note?: string | null; noteShared: boolean; onlyMe: boolean; createdAt: ISODate }

// ---------- Trusted contacts & calls (Module A/G) ----------
// GET    /me/contacts                     -> ContactDTO[]
// POST   /me/contacts  body CreateContactReq -> ContactDTO  [senior]
// DELETE /me/contacts/:id               -> 204             [senior]
// POST   /me/call-logs body CallLogReq   -> ActionLogDTO   (records 'call_started_from_app' — never "connected")
// GET    /me/action-logs                 -> ActionLogDTO[]
export interface ContactDTO { id: string; name: string; relationship: string; phone: string; linkedUserId?: string | null }
export interface CreateContactReq { name: string; relationship: string; phone: string }
export interface CallLogReq { contactId?: string; directoryEntryId?: string }
export interface ActionLogDTO { id: string; kind: 'call_started_from_app' | 'help_request_sent' | 'alert_acknowledged'; label: string; target?: string; createdAt: ISODate }

// ---------- Help directory (Module G) ----------
// GET /directory?country=TH -> DirectoryEntryDTO[]   (public to signed-in users)
export interface DirectoryEntryDTO {
  id: string; country: string; name: { th: string; en: string }; purpose: { th: string; en: string };
  phone: string; kind: 'medical_emergency' | 'police' | 'anti_scam' | 'bank_fraud' | 'social_support';
  verification: DirectoryVerification; sourceUrl?: string | null; verifiedBy?: string | null; verifiedAt?: ISODate | null;
}

// ---------- Help requests & alerts (Module I) ----------
// POST /me/help-requests body HelpRequestReq -> AlertDTO (with deliveries)   [senior]
//   If no member holds 'help_requests', deliveries = [] and noRecipients = true — UI must say
//   "no one is set up to receive this" and show 1669 — never "sent" (SR-12).
// GET  /me/alerts                              -> AlertDTO[]  (senior: alerts about me, with delivery states)
// GET  /alerts                                 -> AlertDTO[]  (recipient view; only alerts addressed to me)
// GET  /alerts/:id                             -> AlertDTO   (grant re-checked; else 404)
// POST /alerts/:id/ack                         -> AlertDTO   (grant re-checked; else 404)
// Recipient view: `deliveries` contains ONLY the caller's own delivery; other recipients are not revealed (SR-06).
export interface HelpRequestReq { message?: string }
export interface DeliveryDTO {
  notificationId: string; recipientId: string; recipientName: string; channel: NotificationChannel;
  state: NotificationState; attempts: number; updatedAt: ISODate;
}
export interface AlertDTO {
  id: string; seniorId: string; seniorName: string; kind: AlertKind; origin: AlertOrigin;
  summary: string; createdAt: ISODate;
  acknowledgedBy?: { userId: string; name: string; at: ISODate } | null;
  deliveries: DeliveryDTO[]; // senior sees all; recipient sees only own
  noRecipients?: boolean;
}

// ---------- Notifications ----------
// GET  /notifications                -> NotificationDTO[]
// POST /notifications/:id/seen       -> NotificationDTO
export interface NotificationDTO {
  id: string; alertId?: string | null; title: string; /** minimal, no sensitive detail */ body: string;
  state: NotificationState; channel: NotificationChannel; createdAt: ISODate;
  /** true when the underlying item is no longer visible for ANY reason (revoked, expired, deleted) — same text for all (SR-07). */
  contentUnavailable: boolean;
  /** true for simulated push/email adapters; UI must label as "simulated (test)" (SR-16). */
  simulated: boolean;
}

// ---------- ScamShield (Module D) ----------
// POST /me/scam-checks body ScamCheckReq -> ScamAssessmentDTO
// GET  /me/scam-checks                   -> ScamAssessmentDTO[]
// POST /me/scam-checks/:id/share body ShareReq -> ScamAssessmentDTO  [senior]  (SR-04: every recipient must be a confirmed
//      member with an active 'scam_checks' grant and must not be a caregiver, else 400 listing nothing about why per user;
//      shares stored PER RECIPIENT and re-checked on read; creates alert)
// GET  /seniors/:seniorId/scam-checks    -> SharedScamCheckDTO[] (grant 'scam_checks'; only items shared WITH THE CALLER)
export interface ShareReq { shareWithUserIds: string[] }
export interface ScamCheckReq { text?: string; url?: string; phone?: string; locale?: Locale }
export interface ScamEvidence { signal: ScamSignal; quote?: string; explanation: { th: string; en: string } }
export interface ScamAssessmentDTO {
  id: string; risk: RiskLevel; evidence: ScamEvidence[];
  explanation: { th: string; en: string }; uncertainty: { th: string; en: string };
  verificationSteps: { th: string; en: string }[];
  engine: { name: 'rules'; version: string; aiExplainer: boolean };
  /** senior view: user ids this item is shared with */
  sharedWith: string[]; createdAt: ISODate;
  /** senior view only: the submitted text, defanged (never rendered as link/tel) */
  submittedText?: string;
}
/** Grantee view: no raw submitted text beyond evidence quotes (defanged). */
export type SharedScamCheckDTO = Omit<ScamAssessmentDTO, 'sharedWith' | 'submittedText'>;

// ---------- Guardian Pause (Module E) ----------
// POST /me/guardian-pause body GuardianPauseReq -> GuardianPauseDTO
// GET  /me/guardian-pause                        -> GuardianPauseDTO[]
// POST /me/guardian-pause/:id/share body ShareReq -> GuardianPauseDTO  [senior] (same rules as scam share, grant 'transfer_pauses')
// GET  /seniors/:seniorId/guardian-pause -> SharedGuardianPauseDTO[] (only items shared with the caller; amount as bucket; no recipientNote) (SR-23)
// Copy rule (SR-10): actions say "someone you trust" — never assume family is safe.
export interface GuardianPauseAnswers { knowsRecipientPersonally: boolean; pressuredToActNow: boolean; toldToKeepSecret: boolean; verifiedIndependently: boolean }
export interface GuardianPauseReq { amountThb: number; answers: GuardianPauseAnswers; recipientNote?: string }
export interface GuardianPauseDTO {
  id: string; amountThb: number; answers: GuardianPauseAnswers;
  level: 'proceed_with_care' | 'stop_and_verify'; reasons: { th: string; en: string }[];
  sharedWith: string[]; createdAt: ISODate;
  /** Always true: the app never touches a bank. Shown in UI. */
  simulationOnly: true;
}
export interface SharedGuardianPauseDTO {
  id: string; amountBucket: AmountBucket; level: GuardianPauseDTO['level']; reasons: { th: string; en: string }[];
  createdAt: ISODate; simulationOnly: true;
}

// ---------- Family Circle & consent (Module F) ----------
// POST   /me/invitations body InviteReq -> InviteDTO  [senior] (returns invite LINK token ONCE: 128-bit random, stored hashed,
//        single-use, 72h TTL. NO spoken code — reading codes aloud mimics OTP scams (SR-08/09).)
// GET    /me/invitations                -> InviteDTO[] [senior] (no token)
// DELETE /me/invitations/:id            -> 204         [senior] (cancel)
// POST   /invitations/accept body AcceptInviteReq -> AcceptInviteRes (invitee signed in; token in BODY, never query/logs;
//        5 failed attempts per invite -> invalidated). Creates membership in state 'pending_confirmation' with ZERO grants.
// POST   /me/invitations/:id/confirm body StepUpReq -> MemberDTO [senior][step-up] — senior sees invitee's account name +
//        the name/relationship SHE typed, and confirms. Only then the member becomes active (SR-08).
// GET    /me/members                    -> MemberDTO[]  [senior] (SR-06: other roles get 404)
// DELETE /me/members/:userId body StepUpReq -> 204  [senior][step-up] (removes membership + revokes grants; audited)
// GET    /me/grants                     -> GrantDTO[] (senior: all incl. history; grantee: ONLY own ACTIVE grants, no revokedAt) (SR-07)
// POST   /me/grants body CreateGrantReq -> GrantDTO   [senior] (caregiver membership + CAREGIVER_FORBIDDEN -> 403;
//        scam_checks/transfer_pauses/checkins additionally [step-up])
// DELETE /me/grants/:id                 -> GrantDTO (revoked) [senior]
// GET    /me/access-log                 -> AccessLogDTO[] [senior] (who viewed my info)
export interface InviteReq { inviteeName: string; relationship: string; role: 'family' | 'caregiver' }
export interface InviteDTO { id: string; inviteeName: string; relationship: string; role: 'family' | 'caregiver'; status: 'pending' | 'pending_confirmation' | 'confirmed' | 'cancelled' | 'expired'; expiresAt: ISODate; token?: string; inviteUrl?: string; acceptedByAccountName?: string | null }
export interface AcceptInviteReq { token: string }
export interface AcceptInviteRes { status: 'pending_confirmation'; seniorFirstName: string }
export interface StepUpReq { password: string }
export interface MemberDTO { userId: string; name: string; role: 'family' | 'caregiver'; relationship: string; joinedAt: ISODate; activeGrants: ShareCategory[] }
export interface CreateGrantReq { granteeUserId: string; category: ShareCategory; expiresAt?: ISODate /* default +90d, max +365d */; password?: string /* step-up for sensitive categories */ }
export interface GrantDTO { id: string; granteeUserId: string; granteeName: string; seniorId: string; category: ShareCategory; createdAt: ISODate; expiresAt: ISODate; revokedAt?: ISODate | null; consentTextVersion: string }
export interface AccessLogDTO { id: string; viewerName: string; category: ShareCategory; at: ISODate }

// ---------- Family dashboard (Module H) ----------
// GET /dashboard -> DashboardDTO   (family/caregiver; everything filtered by active grants)
// SR-01: status computed PER VIEWER from visibleCategories only (e.g. verify_possible_scam only if the viewer holds
//   scam_checks/transfer_pauses AND the item was shared with them). Zero relevant grants -> 'not_shared'.
// SR-03: lastUpdatedAt = newest item THIS viewer can see (never from onlyMe/unshared activity).
export interface DashboardSeniorCard {
  seniorId: string; seniorName: string; relationship: string; status: DashboardStatus;
  /** Categories this viewer may see right now. Items below are present ONLY if granted. */
  visibleCategories: ShareCategory[];
  latestCheckin?: { mood: Mood; at: ISODate; note?: string | null } | null; // null => "no check-in yet" (neutral)
  pendingAlerts?: AlertDTO[];
  sharedScamChecks?: SharedScamCheckDTO[];
  sharedTransferPauses?: SharedGuardianPauseDTO[];
  lastUpdatedAt?: ISODate | null;
}
export interface DashboardDTO { seniors: DashboardSeniorCard[] }

// ---------- Admin (P1, operational only — never personal content) ----------
// GET /admin/overview -> AdminOverviewDTO
export interface AdminOverviewDTO {
  users: Record<Role, number>; families: number;
  notifications: Record<NotificationState, number>; failedDeliveriesLast24h: number;
  directoryUnverified: number; generatedAt: ISODate;
}

// ---------- Billing (P1 sandbox) ----------
// GET  /billing/plans                    -> PlanDTO[]
// GET  /me/subscription                  -> SubscriptionDTO | null
// POST /me/subscription/checkout body { planId } -> { checkoutUrl: string; sandbox: true }
// POST /me/subscription/cancel           -> SubscriptionDTO
// POST /webhooks/payments/sandbox        (HMAC header x-fg-signature; idempotent on eventId)
export interface PlanDTO { id: 'free' | 'family_care' | 'guardian_plus'; name: { th: string; en: string }; priceThbMonthly: number; features: string[]; hypothesis: true }
export interface SubscriptionDTO { id: string; planId: PlanDTO['id']; status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'refunded'; currentPeriodEnd: ISODate; provider: 'sandbox' }

// ---------- Engine result types (what @fg/ai returns; API adds ids/sharing) ----------
export type ScamEngineResult = Omit<ScamAssessmentDTO, 'id' | 'sharedWith' | 'submittedText' | 'createdAt'>;
export type GuardianPauseEngineResult = Pick<GuardianPauseDTO, 'level' | 'reasons'>;
