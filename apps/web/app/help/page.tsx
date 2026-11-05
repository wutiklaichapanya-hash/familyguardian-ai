'use client';

import { Icon } from '@/components/icons';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertDTO } from '@fg/shared';
import { api, isGrantActive } from '@/lib/api';
import { helpOutcome } from '@/lib/delivery';
import { formatDateTime, formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { DeliveryList } from '@/components/DeliveryList';
import { AlertRegion, BackHome, LoadError, RequireRole, Status, useErrorMessage } from '@/components/ui';

const POLL_MS = 5000;

/** null = loading, 'error' = lookup failed, string[] = names holding an active help_requests grant. */
type Recipients = string[] | null | 'error';

function HelpInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState<AlertDTO | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [recipients, setRecipients] = useState<Recipients>(null);
  // Freshness is tracked separately from the data so a failed refresh is never shown as current.
  const [initialLoad, setInitialLoad] = useState<'loading' | 'done' | 'error'>('loading');
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const statusRef = useRef<HTMLElement>(null);

  const loadRecipients = useCallback(() => {
    setRecipients(null);
    api
      .grants()
      .then((gs) => {
        const names = gs.filter((g) => g.category === 'help_requests' && isGrantActive(g)).map((g) => g.granteeName);
        setRecipients([...new Set(names)]);
      })
      .catch(() => setRecipients('error'));
  }, []);

  const refresh = useCallback(async (id?: string) => {
    setChecking(true);
    try {
      const list = await api.myAlerts();
      const mine = list.filter((a) => a.kind === 'user_requested_help');
      const found = id ? mine.find((a) => a.id === id) : [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (found) setAlert((prev) => (prev && prev.noRecipients && found.noRecipients === undefined ? { ...found, noRecipients: true } : found));
      setLastChecked(new Date().toISOString());
      setRefreshFailed(false);
      setInitialLoad('done');
    } catch {
      // Keep the previous state on screen, but say plainly that it could not be re-checked.
      setRefreshFailed(true);
      setInitialLoad((s) => (s === 'loading' ? 'error' : s));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    loadRecipients();
  }, [refresh, loadRecipients]);

  // Poll every 5 s while a request is open and not yet acknowledged.
  useEffect(() => {
    if (!alert || helpOutcome(alert) !== 'awaiting') return;
    const id = window.setInterval(() => void refresh(alert.id), POLL_MS);
    return () => window.clearInterval(id);
  }, [alert, refresh]);

  async function send() {
    setError('');
    setBusy(true);
    try {
      // The API re-checks recipients at send time; the preview above is informational only.
      const a = await api.requestHelp({ message: message.trim() || undefined });
      setAlert(a);
      setJustSent(true);
      setMessage('');
      setLastChecked(new Date().toISOString());
      setRefreshFailed(false);
      setInitialLoad('done');
      requestAnimationFrame(() => statusRef.current?.focus());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const outcome = alert ? helpOutcome(alert) : null;

  return (
    <>
      <BackHome />
      <div className="page-head">
        <span className="ibadge fc-purple"><Icon name="handRaised" /></span>
        <h1>{t('help.title')}</h1>
      </div>
      <p>{t('help.intro')}</p>
      <div className="card">
        <section aria-labelledby="help-recipients-h">
          <h2 id="help-recipients-h">{t('help.recipientsTitle')}</h2>
          {recipients === null && <p>{t('common.loading')}</p>}
          {recipients === 'error' && (
            <div className="notice notice-warm">
              <p>{t('help.recipientsError')}</p>
              <button type="button" className="btn btn-secondary" onClick={loadRecipients}>
                {t('common.retry')}
              </button>
            </div>
          )}
          {Array.isArray(recipients) && recipients.length === 0 && (
            <div className="notice notice-warm">
              <p>{t('help.recipientsNone')}</p>
              <p>
                <Link href="/privacy">{t('help.setupLink')}</Link>
              </p>
            </div>
          )}
          {Array.isArray(recipients) && recipients.length > 0 && (
            <>
              <p>
                <strong>{t('help.recipientsList', { names: recipients.join(', ') })}</strong>
              </p>
              <p className="muted small">{t('help.recipientsNote')}</p>
            </>
          )}
        </section>
        <div className="field">
          <label htmlFor="help-msg">
            {t('help.message')} <span className="muted">{t('common.optional')}</span>
          </label>
          <textarea id="help-msg" value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <AlertRegion>{error}</AlertRegion>
        <button type="button" className="btn btn-primary btn-block" onClick={send} disabled={busy}>
          <Icon name="handRaised" size="1.2em" />
          {busy ? t('help.sending') : t('help.send')}
        </button>
        <p className="muted small">{t('help.notAgency')}</p>
      </div>

      {initialLoad === 'loading' && !alert && <Status>{t('common.loading')}</Status>}
      {initialLoad === 'error' && !alert && <LoadError message={t('help.loadFailed')} onRetry={() => void refresh()} />}

      {alert && (
        <section ref={statusRef} tabIndex={-1} aria-labelledby="help-status-h" className="card">
          <h2 id="help-status-h">{justSent ? t('help.statusTitle') : t('help.previous')}</h2>
          <p className="muted">{t('help.sentAt', { time: formatDateTime(alert.createdAt, locale) })}</p>
          <div role="status" aria-live="polite">
            {outcome === 'no_recipients' ? (
              <div className="notice notice-warm">
                <p><strong>{t('help.noRecipients')}</strong></p>
                <p><Link href="/privacy">{t('help.setupLink')}</Link></p>
                <p>{t('help.noRecipientsUrgent')}</p>
              </div>
            ) : (
              <>
                <DeliveryList deliveries={alert.deliveries} />
                {alert.acknowledgedBy ? (
                  // A recorded button press, styled as information — not as resolution.
                  <div className="notice">
                    <p>
                      <strong>{t('help.acked', { name: alert.acknowledgedBy.name, time: formatTime(alert.acknowledgedBy.at, locale) })}</strong>
                    </p>
                    <p>{t('help.ackMeaning')}</p>
                  </div>
                ) : (
                  <p className="notice notice-warm"><strong>{t('help.noAck')}</strong></p>
                )}
              </>
            )}
          </div>

          {outcome !== 'no_recipients' && (
            <div className="freshness">
              {refreshFailed ? (
                <p className="notice notice-warm" role="alert">
                  <strong>{t('help.checkFailed')}</strong>
                  {lastChecked && (
                    <>
                      <br />
                      {t('help.showingFrom', { time: formatTime(lastChecked, locale) })}
                    </>
                  )}
                </p>
              ) : (
                lastChecked && <p className="muted small">{t('help.checkedAt', { time: formatTime(lastChecked, locale) })}</p>
              )}
              {outcome === 'awaiting' && !refreshFailed && <p className="muted small">{t('help.autoRefresh')}</p>}
              <button type="button" className="btn btn-secondary" onClick={() => void refresh(alert.id)} disabled={checking}>
                {t('help.refresh')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Always available, before and after any acknowledgement: pressing Acknowledge does not mean contact will follow. */}
      <section aria-labelledby="help-alt-h" className="card">
        <h2 id="help-alt-h">{t('help.alternativesTitle')}</h2>
        <div className="stack">
          <Link className="btn btn-secondary btn-block" href="/contacts">
            <Icon name="phone" size="1.2em" />
            {t('checkin.footerContacts')}
          </Link>
          <a className="btn btn-danger btn-block" href="tel:1669">
            <Icon name="phone" size="1.2em" />
            {t('common.call1669')}
          </a>
          <Link className="btn btn-secondary btn-block" href="/emergency">
            {t('help.openEmergency')}
          </Link>
        </div>
      </section>
    </>
  );
}

export default function HelpPage() {
  return (
    <RequireRole roles={['senior']}>
      <HelpInner />
    </RequireRole>
  );
}
