'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CAREGIVER_FORBIDDEN, SHARE_CATEGORIES,
  type AccessLogDTO, type GrantDTO, type InviteDTO, type MemberDTO, type ShareCategory,
} from '@fg/shared';
import { api, isGrantActive, STEP_UP_CATEGORIES } from '@/lib/api';
import { formatDateTime, formatLongDate } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { SessionsSection } from '@/components/SessionsSection';
import { StepUpDialog } from '@/components/StepUpDialog';
import {
  AlertRegion, BackHome, Chip, ConfirmDialog, ErrorSummary, ErrorText, LoadError, RequireRole, Status, useErrorMessage,
} from '@/components/ui';

const EXPIRY_DAYS = [30, 90, 365] as const;
const SECTIONS = ['members', 'grants', 'invites', 'log'] as const;
type Section = (typeof SECTIONS)[number];

type StepUp =
  | { kind: 'grant'; member: MemberDTO; category: ShareCategory }
  | { kind: 'remove'; member: MemberDTO }
  | { kind: 'confirm'; invite: InviteDTO };

function inviteLink(inv: InviteDTO): string | null {
  if (inv.inviteUrl) return inv.inviteUrl;
  if (!inv.token) return null;
  // Token in the fragment: never sent to any server in a request line or logged.
  return `${window.location.origin}/invite/accept#token=${encodeURIComponent(inv.token)}`;
}

function PrivacyInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [members, setMembers] = useState<MemberDTO[] | null>(null);
  // null = not loaded. Each dataset loads and fails independently (Codex UX P0 #11): a failed
  // access-log request must never hide the sharing controls.
  const [grants, setGrants] = useState<GrantDTO[] | null>(null);
  const [invites, setInvites] = useState<InviteDTO[] | null>(null);
  const [log, setLog] = useState<AccessLogDTO[] | null>(null);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<Section, string>>>({});
  const [status, setStatus] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(90);
  const [toRevoke, setToRevoke] = useState<{ grant: GrantDTO; member: MemberDTO } | null>(null);
  const [stepUp, setStepUp] = useState<StepUp | null>(null);
  // invite form
  const [invName, setInvName] = useState('');
  const [invRel, setInvRel] = useState('');
  const [invRole, setInvRole] = useState<'family' | 'caregiver'>('family');
  const [invErr, setInvErr] = useState<{ name?: string; rel?: string; form?: string }>({});
  const [created, setCreated] = useState<InviteDTO | null>(null);
  const [copied, setCopied] = useState('');

  const cat = (c: ShareCategory) => t(`cat.${c}`);

  const loadSection = useCallback(async (s: Section) => {
    setLoadErrors((e) => ({ ...e, [s]: '' }));
    try {
      if (s === 'members') setMembers(await api.members());
      else if (s === 'grants') setGrants(await api.grants());
      else if (s === 'invites') setInvites(await api.invitations());
      else setLog(await api.accessLog());
    } catch (e) {
      setLoadErrors((errs) => ({ ...errs, [s]: errMsg(e) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const load = useCallback(async () => {
    await Promise.all(SECTIONS.map((s) => loadSection(s)));
  }, [loadSection]);
  useEffect(() => {
    void load();
  }, [load]);

  const sectionError = (s: Section) =>
    loadErrors[s] ? (
      <LoadError message={`${t('privacy.sectionFailed')} — ${loadErrors[s]}`} onRetry={() => void loadSection(s)} />
    ) : null;

  const activeGrant = (userId: string, c: ShareCategory) =>
    (grants ?? []).find((g) => g.granteeUserId === userId && g.category === c && isGrantActive(g));

  async function doGrant(member: MemberDTO, category: ShareCategory, password?: string) {
    const expiresAt = new Date(Date.now() + expiryDays * 86400_000).toISOString();
    const g = await api.createGrant({ granteeUserId: member.userId, category, expiresAt, password });
    setGrants((gs) => [...(gs ?? []), g]);
    setStatus(t('privacy.granted', { category: cat(category), name: member.name, date: formatLongDate(g.expiresAt, locale) }));
  }

  async function onShareClick(member: MemberDTO, category: ShareCategory) {
    if ((STEP_UP_CATEGORIES as readonly string[]).includes(category)) {
      setStepUp({ kind: 'grant', member, category });
      return;
    }
    try {
      await doGrant(member, category);
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  async function confirmRevoke() {
    const r = toRevoke;
    setToRevoke(null);
    if (!r) return;
    try {
      const g = await api.revokeGrant(r.grant.id);
      setGrants((gs) => (gs ?? []).map((x) => (x.id === g.id ? g : x)));
      setStatus(t('privacy.revoked', { category: cat(r.grant.category), name: r.member.name }));
      void load();
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  async function runStepUp(password: string) {
    const s = stepUp;
    if (!s) return;
    if (s.kind === 'grant') {
      await doGrant(s.member, s.category, password);
    } else if (s.kind === 'remove') {
      await api.removeMember(s.member.userId, { password });
      setStatus(t('privacy.removed', { name: s.member.name }));
      await load();
    } else {
      const m = await api.confirmInvitation(s.invite.id, { password });
      setStatus(t('privacy.confirmed', { name: m.name }));
      await load();
    }
  }

  async function cancelInvite(inv: InviteDTO) {
    try {
      await api.cancelInvitation(inv.id);
      setStatus(t('privacy.inviteCancelled', { name: inv.inviteeName }));
      await load();
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    const errs: typeof invErr = {};
    if (!invName.trim()) errs.name = t('contacts.fieldRequired');
    if (!invRel.trim()) errs.rel = t('contacts.fieldRequired');
    setInvErr(errs);
    if (errs.name || errs.rel) {
      // Move focus to the first invalid field (WCAG 3.3.1); the summary above announces all of them.
      document.getElementById(errs.name ? 'inv-name' : 'inv-rel')?.focus();
      return;
    }
    try {
      const inv = await api.invite({ inviteeName: invName.trim(), relationship: invRel.trim(), role: invRole });
      setCreated(inv);
      setCopied('');
      setInvName('');
      setInvRel('');
      const list = await api.invitations().catch(() => null);
      if (list) setInvites(list);
    } catch (err) {
      setInvErr({ form: errMsg(err) });
    }
  }

  const pendingConfirm = (invites ?? []).filter((i) => i.status === 'pending_confirmation');
  const otherInvites = (invites ?? []).filter((i) => i.status !== 'pending_confirmation');
  const invSummary = [
    ...(invErr.name ? [{ fieldId: 'inv-name', label: t('privacy.inviteName'), message: invErr.name }] : []),
    ...(invErr.rel ? [{ fieldId: 'inv-rel', label: t('privacy.inviteRel'), message: invErr.rel }] : []),
  ];
  const createdLink = created ? inviteLink(created) : null;

  let stepUpTitle = '';
  let stepUpLabel = '';
  if (stepUp?.kind === 'grant') {
    stepUpTitle = t('privacy.shareAria', { category: cat(stepUp.category), name: stepUp.member.name });
    stepUpLabel = t('privacy.shareBtn');
  } else if (stepUp?.kind === 'remove') {
    stepUpTitle = t('privacy.removeConfirm', { name: stepUp.member.name });
    stepUpLabel = t('privacy.remove', { name: stepUp.member.name });
  } else if (stepUp?.kind === 'confirm') {
    stepUpTitle = t('privacy.confirmBtn', { name: stepUp.invite.inviteeName });
    stepUpLabel = t('common.confirm');
  }

  return (
    <>
      <BackHome />
      <h1>{t('privacy.title')}</h1>
      <p>{t('privacy.intro')}</p>
      <p className="notice">{t('privacy.review')}</p>
      <p className="muted small">{t('coercion.note')}</p>
      <Status className="notice">{status}</Status>

      <section aria-labelledby="pc-h" className="card">
        <h2 id="pc-h">{t('privacy.pendingConfirmTitle')}</h2>
        {sectionError('invites')}
        {!invites && !loadErrors.invites && <p>{t('common.loading')}</p>}
        {!invites ? null : pendingConfirm.length === 0 ? (
          <p className="muted">{t('privacy.noPendingConfirm')}</p>
        ) : (
          <ul className="list-plain">
            {pendingConfirm.map((inv) => (
              <li key={inv.id}>
                <p>
                  {t('privacy.pendingConfirmRow', {
                    account: inv.acceptedByAccountName ?? '—',
                    name: inv.inviteeName,
                    relationship: inv.relationship,
                  })}
                </p>
                <p className="muted small">{t('privacy.confirmCheck')}</p>
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" onClick={() => setStepUp({ kind: 'confirm', invite: inv })}>
                    {t('privacy.confirmBtn', { name: inv.inviteeName })}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => void cancelInvite(inv)}>
                    {t('privacy.cancelInvite', { name: inv.inviteeName })}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="members-h">
        <h2 id="members-h">{t('privacy.membersTitle')}</h2>
        <div className="field">
          <label htmlFor="expiry">{t('privacy.expiryLabel')}</label>
          <select id="expiry" value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
            {EXPIRY_DAYS.map((d) => (
              <option key={d} value={d}>
                {t('privacy.days', { n: d })}
              </option>
            ))}
          </select>
        </div>
        {sectionError('members')}
        {sectionError('grants')}
        {!members && !loadErrors.members && <p>{t('common.loading')}</p>}
        {members && members.length === 0 && <p>{t('privacy.noMembers')}</p>}
        {members?.map((m) => (
          <section key={m.userId} className="card" aria-labelledby={`m-${m.userId}`}>
            <h3 id={`m-${m.userId}`}>{m.name}</h3>
            <p className="muted small">{t('privacy.memberMeta', { relationship: m.relationship, role: t(`role.${m.role}`) })}</p>
            <ul className="list-plain">
              {SHARE_CATEGORIES.map((c) => {
                const g = activeGrant(m.userId, c);
                const forbidden = m.role === 'caregiver' && CAREGIVER_FORBIDDEN.includes(c);
                return (
                  <li key={c} className="row">
                    <span>
                      <strong>{cat(c)}</strong>
                      <br />
                      {forbidden ? (
                        <span className="muted small">{t('privacy.caregiverForbidden')}</span>
                      ) : !grants ? (
                        // Unknown is never shown as "not shared".
                        <span className="muted small">{loadErrors.grants ? t('privacy.sectionFailed') : t('common.loading')}</span>
                      ) : g ? (
                        <Chip tone="brand" icon="👁">{t('privacy.sharedUntil', { date: formatLongDate(g.expiresAt, locale) })}</Chip>
                      ) : (
                        <span className="muted small">{t('privacy.notShared')}</span>
                      )}
                    </span>
                    {!forbidden &&
                      grants &&
                      (g ? (
                        <button type="button" className="btn btn-secondary" aria-label={t('privacy.revokeAria', { category: cat(c), name: m.name })} onClick={() => setToRevoke({ grant: g, member: m })}>
                          {t('privacy.revokeBtn')}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary" aria-label={t('privacy.shareAria', { category: cat(c), name: m.name })} onClick={() => void onShareClick(m, c)}>
                          {t('privacy.shareBtn')}
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
            <button type="button" className="link-button" onClick={() => setStepUp({ kind: 'remove', member: m })}>
              {t('privacy.remove', { name: m.name })}
            </button>
          </section>
        ))}
      </section>

      <section aria-labelledby="invite-h" className="card">
        <h2 id="invite-h">{t('privacy.inviteTitle')}</h2>
        <p className="muted small">{t('privacy.inviteNoGrants')}</p>
        <form onSubmit={onInvite} noValidate>
          <ErrorSummary errors={invSummary} />
          <div className="field">
            <label htmlFor="inv-name">{t('privacy.inviteName')}</label>
            <input id="inv-name" type="text" value={invName} onChange={(e) => setInvName(e.target.value)} aria-invalid={!!invErr.name || undefined} aria-describedby={invErr.name ? 'inv-name-err' : undefined} />
            <ErrorText id="inv-name-err">{invErr.name}</ErrorText>
          </div>
          <div className="field">
            <label htmlFor="inv-rel">{t('privacy.inviteRel')}</label>
            <input id="inv-rel" type="text" value={invRel} onChange={(e) => setInvRel(e.target.value)} aria-invalid={!!invErr.rel || undefined} aria-describedby={invErr.rel ? 'inv-rel-err' : undefined} />
            <ErrorText id="inv-rel-err">{invErr.rel}</ErrorText>
          </div>
          <fieldset>
            <legend>{t('privacy.inviteRole')}</legend>
            <div className="yesno">
              {(['family', 'caregiver'] as const).map((r) => (
                <label key={r} htmlFor={`inv-role-${r}`}>
                  <input id={`inv-role-${r}`} type="radio" name="inv-role" checked={invRole === r} onChange={() => setInvRole(r)} />
                  {t(`role.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <AlertRegion>{invErr.form}</AlertRegion>
          <button type="submit" className="btn btn-primary btn-block">{t('privacy.inviteSubmit')}</button>
        </form>
        {created && (
          <div className="notice" role="status">
            <h3>{t('privacy.inviteLinkTitle', { name: created.inviteeName })}</h3>
            <p>{t('privacy.inviteLinkOnce', { name: created.inviteeName })}</p>
            {createdLink && (
              <div className="field">
                <label htmlFor="inv-link">{t('privacy.inviteLinkLabel')}</label>
                <input id="inv-link" type="text" readOnly value={createdLink} onFocus={(e) => e.currentTarget.select()} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(createdLink);
                      setCopied(t('privacy.copied'));
                    } catch {
                      document.getElementById('inv-link')?.focus();
                    }
                  }}
                >
                  {t('privacy.copy')}
                </button>
                <Status>{copied}</Status>
              </div>
            )}
            <p className="small">{t('privacy.expires', { date: formatDateTime(created.expiresAt, locale) })}</p>
            <p className="small muted">{t('privacy.noCodeNote')}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="inv-list-h" className="card">
        <h2 id="inv-list-h">{t('privacy.pendingTitle')}</h2>
        {!invites ? (
          <p className="muted">{loadErrors.invites ? t('privacy.sectionFailed') : t('common.loading')}</p>
        ) : otherInvites.length === 0 ? (
          <p className="muted">{t('privacy.noInvites')}</p>
        ) : (
          <ul className="list-plain">
            {otherInvites.map((inv) => (
              <li key={inv.id} className="row">
                <span>
                  {inv.inviteeName} · {inv.relationship} · {t(`role.${inv.role}`)}
                  <br />
                  <Chip>{t(`inv.${inv.status}`)}</Chip>{' '}
                  {inv.status === 'pending' && <span className="muted small">{t('privacy.expires', { date: formatDateTime(inv.expiresAt, locale) })}</span>}
                </span>
                {inv.status === 'pending' && (
                  <button type="button" className="btn btn-secondary" onClick={() => void cancelInvite(inv)}>
                    {t('privacy.cancelInvite', { name: inv.inviteeName })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="log-h" className="card">
        <h2 id="log-h">{t('privacy.logTitle')}</h2>
        {sectionError('log')}
        {!log && !loadErrors.log && <p>{t('common.loading')}</p>}
        {log && log.length === 0 && <p className="muted">{t('privacy.logEmpty')}</p>}
        {log && log.length > 0 && (
          <ul className="list-plain">
            {log.slice(0, 50).map((a) => (
              <li key={a.id}>{t('privacy.logRow', { name: a.viewerName, category: cat(a.category), time: formatDateTime(a.at, locale) })}</li>
            ))}
          </ul>
        )}
      </section>

      <SessionsSection />

      <ConfirmDialog
        open={!!toRevoke}
        title={toRevoke ? t('privacy.revokeAria', { category: cat(toRevoke.grant.category), name: toRevoke.member.name }) : ''}
        body={toRevoke ? t('privacy.revokeConfirm', { category: cat(toRevoke.grant.category), name: toRevoke.member.name }) : undefined}
        confirmLabel={t('privacy.revokeBtn')}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setToRevoke(null)}
      />
      <StepUpDialog
        open={!!stepUp}
        title={stepUpTitle}
        body={stepUp?.kind === 'confirm' ? t('privacy.confirmCheck') : undefined}
        confirmLabel={stepUpLabel}
        danger={stepUp?.kind === 'remove'}
        action={runStepUp}
        onClose={() => setStepUp(null)}
      />
    </>
  );
}

export default function PrivacyPage() {
  return (
    <RequireRole roles={['senior']}>
      <PrivacyInner />
    </RequireRole>
  );
}
