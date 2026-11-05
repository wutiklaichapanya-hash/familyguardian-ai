// Row → contract DTO mappers. Viewer-sensitive filtering (notes, quotes, raw text) happens HERE, in one place.
import type {
  AccessLogDTO, ActionLogDTO, AlertDTO, AmountBucket, CheckinDTO, ContactDTO, DeliveryDTO, DirectoryEntryDTO, GrantDTO,
  GuardianPauseAnswers, GuardianPauseDTO, InviteDTO, Locale, NotificationDTO, ScamAssessmentDTO, ScamEngineResult,
  SharedCheckinDTO, SharedGuardianPauseDTO, SharedScamCheckDTO, UserDTO,
} from '@fg/shared';
import type {
  alerts, consentGrants, directoryEntries, guardianPauseSessions, invitations, notifications, scamAssessments,
  trustedContacts, users, wellbeingCheckins, actionLogs,
} from './db/schema';
import { alertSummary, revokedCopy } from './notifications/copy';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];
const iso = (d: Date) => d.toISOString();
const isoN = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export const toUserDTO = (u: Row<typeof users>): UserDTO => ({
  id: u.id, email: u.email, displayName: u.displayName, role: u.role, locale: u.locale, politeParticle: u.politeParticle,
});

/** Senior's own view. */
export const toCheckinDTO = (c: Row<typeof wellbeingCheckins>): CheckinDTO => ({
  id: c.id, mood: c.mood, note: c.note, noteShared: c.noteShared, onlyMe: c.onlyMe, createdAt: iso(c.createdAt),
});
/** Grantee view (SR-02): onlyMe rows are excluded in SQL by the caller; note only if noteShared; no flags. */
export const toSharedCheckinDTO = (c: Row<typeof wellbeingCheckins>): SharedCheckinDTO => ({
  id: c.id, mood: c.mood, ...(c.noteShared && c.note ? { note: c.note } : {}), createdAt: iso(c.createdAt),
});

export const toContactDTO = (c: Row<typeof trustedContacts>): ContactDTO => ({
  id: c.id, name: c.name, relationship: c.relationship, phone: c.phone, linkedUserId: c.linkedUserId,
});

export const toActionLogDTO = (a: Row<typeof actionLogs>): ActionLogDTO => ({
  id: a.id, kind: a.kind, label: a.label, ...(a.target ? { target: a.target } : {}), createdAt: iso(a.createdAt),
});

export const toDirectoryDTO = (d: Row<typeof directoryEntries>): DirectoryEntryDTO => ({
  id: d.id, country: d.country, name: { th: d.nameTh, en: d.nameEn }, purpose: { th: d.purposeTh, en: d.purposeEn },
  phone: d.phone, kind: d.kind, verification: d.verification, sourceUrl: d.sourceUrl, verifiedBy: d.verifiedBy, verifiedAt: isoN(d.verifiedAt),
});

/** Defang URLs so they can never be rendered as live links (SR-18). */
export function defangText(t: string): string {
  return t
    .replace(/\b(h)tt(ps?):\/\//gi, (_m, h: string, p: string) => `${h}xx${p}://`)
    .replace(/\b([a-z0-9-]+)\.(?=[a-z0-9-]+\b)/gi, (m, a: string) => (/^\d+$/.test(a) ? m : `${a}[.]`));
}

/** Senior view: includes sharedWith and the (defanged) submitted text. */
export function toScamDTO(s: Row<typeof scamAssessments>, sharedWith: string[]): ScamAssessmentDTO {
  const r = s.result as ScamEngineResult;
  const submitted = [s.inputText, s.inputUrl, s.inputPhone].filter((x): x is string => !!x).join('\n');
  return {
    id: s.id, risk: s.risk, evidence: r.evidence.map((e) => (e.quote ? { ...e, quote: defangText(e.quote) } : e)),
    explanation: r.explanation, uncertainty: r.uncertainty, verificationSteps: r.verificationSteps, engine: r.engine,
    sharedWith, createdAt: iso(s.createdAt), ...(submitted ? { submittedText: defangText(submitted) } : {}),
  };
}
/** Grantee view: no submitted text, no sharing metadata. Evidence quotes are defanged. */
export function toSharedScamDTO(s: Row<typeof scamAssessments>): SharedScamCheckDTO {
  const { sharedWith: _w, submittedText: _t, ...rest } = toScamDTO(s, []);
  return rest;
}

export const toPauseDTO = (p: Row<typeof guardianPauseSessions>, sharedWith: string[]): GuardianPauseDTO => ({
  id: p.id, amountThb: p.amountThb, answers: p.answers as GuardianPauseAnswers, level: p.level,
  reasons: p.reasons as { th: string; en: string }[], sharedWith, createdAt: iso(p.createdAt), simulationOnly: true,
});
export function amountBucket(thb: number): AmountBucket {
  if (thb < 10_000) return 'under_10k';
  if (thb < 50_000) return '10k_50k';
  if (thb < 200_000) return '50k_200k';
  return 'over_200k';
}
/** Grantee view (SR-23): amount bucket only; never the exact amount, answers or recipientNote. */
export const toSharedPauseDTO = (p: Row<typeof guardianPauseSessions>): SharedGuardianPauseDTO => ({
  id: p.id, amountBucket: amountBucket(p.amountThb), level: p.level, reasons: p.reasons as { th: string; en: string }[],
  createdAt: iso(p.createdAt), simulationOnly: true,
});

/** `asOwner` false (grantee view) omits revokedAt entirely (SR-07). */
export const toGrantDTO = (g: Row<typeof consentGrants>, granteeName: string, asOwner = true): GrantDTO => ({
  id: g.id, granteeUserId: g.granteeUserId, granteeName, seniorId: g.seniorId, category: g.category,
  createdAt: iso(g.createdAt), expiresAt: iso(g.expiresAt), ...(asOwner ? { revokedAt: isoN(g.revokedAt) } : {}), consentTextVersion: g.consentTextVersion,
});

export const toInviteDTO = (i: Row<typeof invitations>, acceptedByAccountName: string | null = null, now = new Date()): InviteDTO => ({
  id: i.id, inviteeName: i.inviteeName, relationship: i.relationship, role: i.role,
  status: i.status === 'pending' && i.expiresAt <= now ? 'expired' : i.status,
  expiresAt: iso(i.expiresAt), acceptedByAccountName,
});

export const toAccessLogDTO = (a: { id: string; viewerName: string; category: AccessLogDTO['category']; at: Date }): AccessLogDTO => ({
  id: a.id, viewerName: a.viewerName, category: a.category, at: iso(a.at),
});

export function toDeliveryDTO(n: Row<typeof notifications>, recipientName: string): DeliveryDTO {
  return { notificationId: n.id, recipientId: n.recipientId, recipientName, channel: n.channel, state: n.state, attempts: n.attempts, updatedAt: iso(n.updatedAt) };
}

export function toAlertDTO(a: Row<typeof alerts>, o: {
  seniorName: string; locale: Locale; asOwner: boolean; ackName: string | null; deliveries: DeliveryDTO[];
}): AlertDTO {
  let summary = alertSummary(a.kind, o.seniorName, o.locale);
  if (o.asOwner && a.seniorMessage) summary += ` — “${a.seniorMessage}”`;
  return {
    id: a.id, seniorId: a.seniorId, seniorName: o.seniorName, kind: a.kind, origin: a.origin, summary, createdAt: iso(a.createdAt),
    acknowledgedBy: a.acknowledgedAt && a.acknowledgedBy ? { userId: a.acknowledgedBy, name: o.ackName ?? '', at: iso(a.acknowledgedAt) } : null,
    deliveries: o.deliveries,
    ...(o.asOwner && o.deliveries.length === 0 ? { noRecipients: true } : {}),
  };
}

/** `stillVisible` = recipient currently holds consent. Revoked, expired or deleted → identical generic copy (SR-07). */
export function toNotificationDTO(n: Row<typeof notifications>, stillVisible: boolean, locale: Locale): NotificationDTO {
  const unavailable = n.contentRevoked || !stillVisible;
  const copy = unavailable ? revokedCopy(locale) : { title: n.title, body: n.body };
  return {
    id: n.id, alertId: unavailable ? null : n.alertId, title: copy.title, body: copy.body, state: n.state, channel: n.channel,
    createdAt: iso(n.createdAt), contentUnavailable: unavailable, simulated: n.channel !== 'in_app',
  };
}
