'use client';

import { Icon } from '@/components/icons';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { NotificationDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { STATE_VISUAL } from '@/lib/visual';
import { AlertRegion, Chip, LoadError, RequireRole, Status, useErrorMessage } from '@/components/ui';

function NotificationsInner() {
  const { t, locale } = useI18n();
  const { me } = useSession();
  const errMsg = useErrorMessage();
  const isSenior = me?.user.role === 'senior';
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const [failedId, setFailedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError('');
    api.notifications().then(setItems).catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markSeen(n: NotificationDTO, announce = true) {
    setActionError('');
    try {
      const updated = await api.markSeen(n.id);
      setItems((xs) => (xs ?? []).map((x) => (x.id === n.id ? updated : x)));
      setFailedId(null);
      if (announce) setStatus(t('notif.seenDone'));
    } catch (e) {
      setFailedId(n.id);
      setActionError(`${t('notif.seenFailed')} — ${errMsg(e)}`);
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="ibadge fc-blue"><Icon name="bell" /></span>
        <h1>{t('notif.title')}</h1>
      </div>
      <LoadError message={error} onRetry={load} />
      <Status>{status}</Status>
      <AlertRegion>{actionError}</AlertRegion>
      {!items && !error && <Status>{t('common.loading')}</Status>}
      {items && items.length === 0 && <p>{t('notif.empty')}</p>}
      {items && items.length > 0 && (
        <ul className="list-plain">
          {items.map((n) => {
            const v = STATE_VISUAL[n.state];
            return (
              <li key={n.id} className="card">
                <div className="row">
                  <Chip tone={v.tone} icon={v.icon}>{t(`chip.${n.state}`)}</Chip>
                  {n.simulated && <Chip tone="neutral" icon="flask">{t('notif.simulated')}</Chip>}
                </div>
                {n.contentUnavailable ? (
                  <p className="muted">{t('notif.unavailable')}</p>
                ) : (
                  <>
                    <h2 className="small" style={{ fontSize: '1.05rem' }}>{n.title}</h2>
                    <p>{n.body}</p>
                  </>
                )}
                <p className="muted small">
                  {t('notif.channel', { channel: t(`channel.${n.channel}`) })} · {formatDateTime(n.createdAt, locale)}
                </p>
                {/* /alerts/[id] is a family/caregiver route; seniors get their own destination instead. */}
                {n.alertId && !n.contentUnavailable && isSenior && (
                  <p className="small">
                    {t('notif.seniorDetail')} <Link href="/help">{t('help.title')}</Link>
                  </p>
                )}
                <div className="btn-row">
                  {n.alertId && !n.contentUnavailable && !isSenior && (
                    <Link className="btn btn-primary" href={`/alerts/${encodeURIComponent(n.alertId)}`} onClick={() => void markSeen(n, false)}>
                      {t('notif.open')}
                    </Link>
                  )}
                  {(n.state === 'sent' || n.state === 'queued') && (
                    <button type="button" className="btn btn-secondary" onClick={() => void markSeen(n)}>
                      {failedId === n.id ? t('common.retry') : t('notif.markSeen')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <RequireRole roles={['family', 'caregiver', 'senior']}>
      <NotificationsInner />
    </RequireRole>
  );
}
