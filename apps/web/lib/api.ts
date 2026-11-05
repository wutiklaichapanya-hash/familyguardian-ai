// The single typed API client for the web app. Types come from the shared contract.
// All calls go through the same-origin Next rewrite (/api/v1 -> API) so the httpOnly
// session cookie stays first-party. Mutating calls always send `x-fg-csrf: 1`.
import type {
  AcceptInviteReq, AcceptInviteRes, AccessLogDTO, ActionLogDTO, AdminOverviewDTO, AlertDTO, CallLogReq,
  CheckinDTO, ContactDTO, CreateCheckinReq, CreateContactReq, CreateGrantReq, DashboardDTO,
  DirectoryEntryDTO, GrantDTO, GuardianPauseDTO, GuardianPauseReq, HelpRequestReq, InviteDTO,
  InviteReq, LoginReq, MeRes, MemberDTO, NotificationDTO, PlanDTO, ScamAssessmentDTO,
  ScamCheckReq, SessionDTO, SharedCheckinDTO, SharedGuardianPauseDTO, SharedScamCheckDTO, ShareReq,
  StepUpReq, SubscriptionDTO,
} from '@fg/shared';

export const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') headers['x-fg-csrf'] = '1';
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Network error');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? res.statusText);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  // Auth
  login: (b: LoginReq) => request<MeRes>('POST', '/auth/login', b),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<MeRes>('GET', '/auth/me'),
  sessions: () => request<SessionDTO[]>('GET', '/auth/sessions'),
  deleteSession: (id: string) => request<void>('DELETE', `/auth/sessions/${enc(id)}`),

  // Check-ins
  createCheckin: (b: CreateCheckinReq) => request<CheckinDTO>('POST', '/me/checkins', b),
  myCheckins: (days = 30) => request<CheckinDTO[]>('GET', `/me/checkins?days=${days}`),

  // Contacts & calls
  contacts: () => request<ContactDTO[]>('GET', '/me/contacts'),
  createContact: (b: CreateContactReq) => request<ContactDTO>('POST', '/me/contacts', b),
  deleteContact: (id: string) => request<void>('DELETE', `/me/contacts/${enc(id)}`),
  logCall: (b: CallLogReq) => request<ActionLogDTO>('POST', '/me/call-logs', b),
  actionLogs: () => request<ActionLogDTO[]>('GET', '/me/action-logs'),

  // Directory
  directory: (country = 'TH') => request<DirectoryEntryDTO[]>('GET', `/directory?country=${enc(country)}`),

  // Help & alerts
  requestHelp: (b: HelpRequestReq) => request<AlertDTO>('POST', '/me/help-requests', b),
  myAlerts: () => request<AlertDTO[]>('GET', '/me/alerts'),
  alerts: () => request<AlertDTO[]>('GET', '/alerts'),
  alert: (id: string) => request<AlertDTO>('GET', `/alerts/${enc(id)}`),
  ackAlert: (id: string) => request<AlertDTO>('POST', `/alerts/${enc(id)}/ack`),

  // Notifications
  notifications: () => request<NotificationDTO[]>('GET', '/notifications'),
  markSeen: (id: string) => request<NotificationDTO>('POST', `/notifications/${enc(id)}/seen`),

  // ScamShield
  scamCheck: (b: ScamCheckReq) => request<ScamAssessmentDTO>('POST', '/me/scam-checks', b),
  myScamChecks: () => request<ScamAssessmentDTO[]>('GET', '/me/scam-checks'),
  shareScamCheck: (id: string, shareWithUserIds: string[]) =>
    request<ScamAssessmentDTO>('POST', `/me/scam-checks/${enc(id)}/share`, { shareWithUserIds } satisfies ShareReq),
  seniorScamChecks: (seniorId: string) => request<SharedScamCheckDTO[]>('GET', `/seniors/${enc(seniorId)}/scam-checks`),
  seniorCheckins: (seniorId: string, days = 30) =>
    request<SharedCheckinDTO[]>('GET', `/seniors/${enc(seniorId)}/checkins?days=${days}`),
  seniorGuardianPauses: (seniorId: string) =>
    request<SharedGuardianPauseDTO[]>('GET', `/seniors/${enc(seniorId)}/guardian-pause`),

  // Guardian Pause
  guardianPause: (b: GuardianPauseReq) => request<GuardianPauseDTO>('POST', '/me/guardian-pause', b),
  shareGuardianPause: (id: string, shareWithUserIds: string[]) =>
    request<GuardianPauseDTO>('POST', `/me/guardian-pause/${enc(id)}/share`, { shareWithUserIds } satisfies ShareReq),

  // Family circle & consent
  invite: (b: InviteReq) => request<InviteDTO>('POST', '/me/invitations', b),
  invitations: () => request<InviteDTO[]>('GET', '/me/invitations'),
  cancelInvitation: (id: string) => request<void>('DELETE', `/me/invitations/${enc(id)}`),
  /** Token travels in the BODY only — never in a query string we send or log. */
  acceptInvite: (b: AcceptInviteReq) => request<AcceptInviteRes>('POST', '/invitations/accept', b),
  /** [step-up] senior re-enters her password to confirm a pending member. */
  confirmInvitation: (id: string, b: StepUpReq) => request<MemberDTO>('POST', `/me/invitations/${enc(id)}/confirm`, b),
  members: () => request<MemberDTO[]>('GET', '/me/members'),
  /** [step-up] */
  removeMember: (userId: string, b: StepUpReq) => request<void>('DELETE', `/me/members/${enc(userId)}`, b),
  grants: () => request<GrantDTO[]>('GET', '/me/grants'),
  /** [step-up] for STEP_UP_CATEGORIES (password in body). */
  createGrant: (b: CreateGrantReq) => request<GrantDTO>('POST', '/me/grants', b),
  revokeGrant: (id: string) => request<GrantDTO>('DELETE', `/me/grants/${enc(id)}`),
  accessLog: () => request<AccessLogDTO[]>('GET', '/me/access-log'),

  // Dashboard & admin
  dashboard: () => request<DashboardDTO>('GET', '/dashboard'),
  adminOverview: () => request<AdminOverviewDTO>('GET', '/admin/overview'),

  // Billing (P1 sandbox)
  plans: () => request<PlanDTO[]>('GET', '/billing/plans'),
  subscription: () => request<SubscriptionDTO | null>('GET', '/me/subscription'),
  checkout: (planId: PlanDTO['id']) =>
    request<{ checkoutUrl: string; sandbox: true }>('POST', '/me/subscription/checkout', { planId }),
  cancelSubscription: () => request<SubscriptionDTO>('POST', '/me/subscription/cancel'),
};

/** Categories whose grant needs the senior's password (contract v0.2, SR-11). */
export const STEP_UP_CATEGORIES = ['checkins', 'scam_checks', 'transfer_pauses'] as const;

/** Drop anything the browser may hold for this origin after sign-out (the API also sends Clear-Site-Data). */
export async function clearClientCaches(): Promise<void> {
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

/** A grant is active if not revoked and not expired. */
export function isGrantActive(g: GrantDTO, now: number = Date.now()): boolean {
  return !g.revokedAt && new Date(g.expiresAt).getTime() > now;
}
