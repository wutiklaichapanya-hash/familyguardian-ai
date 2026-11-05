// HTTP API contract between services/api and apps/web. Base path: /api/v1
// Auth: httpOnly session cookie `fg_session`. Every mutating request MUST send header `x-fg-csrf: 1`
// (custom-header CSRF defence; API CORS allows only WEB_ORIGIN with credentials).
// Errors: { error: { code: string; message: string } } with proper HTTP status (400/401/403/404/409/429).
// CONTRACT — change only with lead approval; both web and api import these types.

import type {
  AlertKind, AlertOrigin, DashboardStatus, DirectoryVerification, Mood, NotificationChannel,
  NotificationState, RiskLevel, Role, ScamSignal, ShareCategory,
} from './domain';
import type { Locale } from './labels';

export type ISODate = string;

// ---------- Auth ----------
// POST /auth/login        body LoginReq            -> MeRes
// POST /auth/logout                                -> 204
// GET  /auth/me                                    -> MeRes
export interface LoginReq { email: string; password: string }
export interface UserDTO { id: string; email: string; displayName: string; role: Role; locale: Locale; politeParticle: 'ka' | 'krap' }
export interface MeRes {
  user: UserDTO;
  /** For family/caregiver: the seniors whose circle they belong to. For senior: their own family id. */
  circles: { familyId: string; seniorId: string; seniorName: string; relationship: string }[];
}

// ---------- Check-ins (Module B) ----------
// POST /me/checkins                      body CreateCheckinReq -> CheckinDTO   (senior only)
// GET  /me/checkins?days=30                                    -> CheckinDTO[] (own)
// GET  /seniors/:seniorId/checkins?days=30                     -> CheckinDTO[] (requires 'checkins' grant; note omitted unless noteShared)
export interface CreateCheckinReq { mood: Mood; note?: string; noteShared?: boolean; onlyMe?: boolean }
export interface CheckinDTO { id: string; mood: Mood; note?: string | null; noteShared: boolean; onlyMe: boolean; createdAt: ISODate }

// ---------- Trusted contacts & calls (Module A/G) ----------
// GET    /me/contacts                     -> ContactDTO[]
// POST   /me/contacts  body CreateContactReq -> ContactDTO
// DELETE /me/contacts/:id               -> 204
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
// POST /me/help-requests body HelpRequestReq -> AlertDTO (with deliveries)   (senior)
// GET  /me/alerts                              -> AlertDTO[]  (senior: alerts about me, with delivery states)
// GET  /alerts                                 -> AlertDTO[]  (recipient view; only alerts addressed to me)
// GET  /alerts/:id                             -> AlertDTO
// POST /alerts/:id/ack                         -> AlertDTO
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
}

// ---------- Notifications ----------
// GET  /notifications                -> NotificationDTO[]
// POST /notifications/:id/seen       -> NotificationDTO
export interface NotificationDTO {
  id: string; alertId?: string | null; title: string; /** minimal, no sensitive detail */ body: string;
  state: NotificationState; channel: NotificationChannel; createdAt: ISODate; contentRevoked: boolean;
}

// ---------- ScamShield (Module D) ----------
// POST /me/scam-checks body ScamCheckReq -> ScamAssessmentDTO
// GET  /me/scam-checks                   -> ScamAssessmentDTO[]
// POST /me/scam-checks/:id/share body { shareWithUserIds: string[] } -> ScamAssessmentDTO  (requires grantee to hold 'scam_checks'; creates alert)
// GET  /seniors/:seniorId/scam-checks    -> ScamAssessmentDTO[] (grant 'scam_checks'; only items the senior shared)
export interface ScamCheckReq { text?: string; url?: string; phone?: string; locale?: Locale }
export interface ScamEvidence { signal: ScamSignal; quote?: string; explanation: { th: string; en: string } }
export interface ScamAssessmentDTO {
  id: string; risk: RiskLevel; evidence: ScamEvidence[];
  explanation: { th: string; en: string }; uncertainty: { th: string; en: string };
  verificationSteps: { th: string; en: string }[];
  engine: { name: 'rules'; version: string; aiExplainer: boolean };
  shared: boolean; createdAt: ISODate;
}

// ---------- Guardian Pause (Module E) ----------
// POST /me/guardian-pause body GuardianPauseReq -> GuardianPauseDTO
// GET  /me/guardian-pause                        -> GuardianPauseDTO[]
// POST /me/guardian-pause/:id/share body { shareWithUserIds: string[] } -> GuardianPauseDTO
export interface GuardianPauseAnswers { knowsRecipientPersonally: boolean; pressuredToActNow: boolean; toldToKeepSecret: boolean; verifiedIndependently: boolean }
export interface GuardianPauseReq { amountThb: number; answers: GuardianPauseAnswers; recipientNote?: string }
export interface GuardianPauseDTO {
  id: string; amountThb: number; answers: GuardianPauseAnswers;
  level: 'proceed_with_care' | 'stop_and_verify'; reasons: { th: string; en: string }[];
  shared: boolean; createdAt: ISODate;
  /** Always true: the app never touches a bank. Shown in UI. */
  simulationOnly: true;
}

// ---------- Family Circle & consent (Module F) ----------
// POST   /me/invitations body InviteReq -> InviteDTO (returns token + 6-digit code ONCE; senior shares code verbally)
// GET    /me/invitations                -> InviteDTO[] (no code)
// POST   /invitations/accept body AcceptInviteReq -> MeRes (invitee must be signed in; membership created with ZERO grants)
// GET    /me/members                    -> MemberDTO[]
// DELETE /me/members/:userId            -> 204 (removes membership + revokes all grants)
// GET    /me/grants                     -> GrantDTO[] (senior: all; grantee: grants they hold)
// POST   /me/grants body CreateGrantReq -> GrantDTO   (senior only; caregiver forbidden categories -> 403)
// DELETE /me/grants/:id                 -> GrantDTO (revoked)
// GET    /me/access-log                 -> AccessLogDTO[] (senior: who viewed my info)
export interface InviteReq { inviteeName: string; relationship: string; role: 'family' | 'caregiver' }
export interface InviteDTO { id: string; inviteeName: string; relationship: string; role: 'family' | 'caregiver'; status: 'pending' | 'accepted' | 'expired'; expiresAt: ISODate; token?: string; code?: string }
export interface AcceptInviteReq { token: string; code: string }
export interface MemberDTO { userId: string; name: string; role: 'family' | 'caregiver'; relationship: string; joinedAt: ISODate; activeGrants: ShareCategory[] }
export interface CreateGrantReq { granteeUserId: string; category: ShareCategory; expiresAt?: ISODate /* default +90d, max +365d */ }
export interface GrantDTO { id: string; granteeUserId: string; granteeName: string; seniorId: string; category: ShareCategory; createdAt: ISODate; expiresAt: ISODate; revokedAt?: ISODate | null; consentTextVersion: string }
export interface AccessLogDTO { id: string; viewerName: string; category: ShareCategory; at: ISODate }

// ---------- Family dashboard (Module H) ----------
// GET /dashboard -> DashboardDTO   (family/caregiver; everything filtered by active grants)
export interface DashboardSeniorCard {
  seniorId: string; seniorName: string; relationship: string; status: DashboardStatus;
  /** Categories this viewer may see right now. Items below are present ONLY if granted. */
  visibleCategories: ShareCategory[];
  latestCheckin?: { mood: Mood; at: ISODate; note?: string | null } | null; // null => "no check-in yet" (neutral)
  pendingAlerts?: AlertDTO[];
  sharedScamChecks?: ScamAssessmentDTO[];
  sharedTransferPauses?: GuardianPauseDTO[];
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
