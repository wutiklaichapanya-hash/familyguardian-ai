'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatDateTime, formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { DeliveryList } from '@/components/DeliveryList';
import { BackHome, ErrorText, RequireRole, Status, useErrorMessage } from '@/components/ui';

const POLL_MS = 5000;

function hasNoRecipients(a: AlertDTO): boolean {
  return a.noRecipients === true || a.deliveries.length === 0;
}

function HelpInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState<AlertDTO | null>(null);
  const [justSent, setJustSent] = useState(false);
  const statusRef = useRef<HTMLElement>(null);

  const refresh = useCallback(async (id?: string) => {
    try {
      const list = await api.myAlerts();
      const mine = list.filter((a) => a.kind === 'user_requested_help');
      const found = id ? mine.find((a) => a.id === id) : [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (found) setAlert((prev) => (prev && prev.noRecipients && found.noRecipients === undefined ? { ...found, noRecipients: true } : found));
    } catch {
      /* keep the last known state; polling retries */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll every 5 s while a request is open and not yet acknowledged.
  useEffect(() => {
    if (!alert || alert.acknowledgedBy || hasNoRecipients(alert)) return;
    const id = window.setInterval(() => void refresh(alert.id), POLL_MS);
    return () => window.clearInterval(id);
  }, [alert, refresh]);

  async function send() {
    setError('');
    setBusy(true);
    try {
      const a = await api.requestHelp({ message: message.trim() || undefined });
      setAlert(a);
      setJustSent(true);
      setMessage('');
      requestAnimationFrame(() => statusRef.current?.focus());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const noRecipients = alert ? hasNoRecipients(alert) : false;

  return (
    <>
      <BackHome />
      <h1>{t('help.title')}</h1>
      <p>{t('help.intro')}</p>
      <div className="card">
        <div className="field">
          <label htmlFor="help-msg">
            {t('help.message')} <span className="muted">{t('common.optional')}</span>
          </label>
          <textarea id="help-msg" value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div role="alert"><ErrorText>{error}</ErrorText></div>
        <button type="button" className="btn btn-primary btn-block" onClick={send} disabled={busy}>
          <span aria-hidden="true">🙋 </span>
          {busy ? t('help.sending') : t('help.send')}
        </button>
        <p className="muted small">{t('help.notAgency')}</p>
      </div>

      {alert && (
        <section ref={statusRef} tabIndex={-1} aria-labelledby="help-status-h" className="card">
          <h2 id="help-status-h">{justSent ? t('help.statusTitle') : t('help.previous')}</h2>
          <p className="muted">{t('help.sentAt', { time: formatDateTime(alert.createdAt, locale) })}</p>
          <div role="status" aria-live="polite">
            {noRecipients ? (
              <div className="notice notice-warm">
                <p><strong>{t('help.noRecipients')}</strong></p>
                <p><Link href="/privacy">{t('help.setupLink')}</Link></p>
                <p>{t('help.noRecipientsUrgent')}</p>
              </div>
            ) : (
              <>
                <DeliveryList deliveries={alert.deliveries} />
                {alert.acknowledgedBy ? (
                  <p className="notice">
                    <strong>
                      <span aria-hidden="true">✓ </span>
                      {t('help.acked', { name: alert.acknowledgedBy.name, time: formatTime(alert.acknowledgedBy.at, locale) })}
                    </strong>
                  </p>
                ) : (
                  <p className="notice notice-warm"><strong>{t('help.noAck')}</strong></p>
                )}
              </>
            )}
          </div>
          {(noRecipients || !alert.acknowledgedBy) && (
            <a className="btn btn-danger btn-block" href="tel:1669">
              <span aria-hidden="true">📞 </span>
              {t('common.call1669')}
            </a>
          )}
          {!noRecipients && !alert.acknowledgedBy && <p className="muted small">{t('help.autoRefresh')}</p>}
        </section>
      )}
      <Status />
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
