'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NotificationDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { STATE_VISUAL } from '@/lib/visual';
import { Chip, RequireRole, Status, useErrorMessage } from '@/components/ui';

function NotificationsInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.notifications().then(setItems).catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markSeen(n: NotificationDTO) {
    try {
      const updated = await api.markSeen(n.id);
      setItems((xs) => (xs ?? []).map((x) => (x.id === n.id ? updated : x)));
    } catch {
      /* non-blocking */
    }
  }

  return (
    <>
      <h1>{t('notif.title')}</h1>
      {error && <p role="alert">{error}</p>}
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
                  {n.simulated && <Chip tone="neutral" icon="🧪">{t('notif.simulated')}</Chip>}
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
                <div className="btn-row">
                  {n.alertId && !n.contentUnavailable && (
                    <Link className="btn btn-primary" href={`/alerts/${encodeURIComponent(n.alertId)}`} onClick={() => void markSeen(n)}>
                      {t('notif.open')}
                    </Link>
                  )}
                  {(n.state === 'sent' || n.state === 'queued') && (
                    <button type="button" className="btn btn-secondary" onClick={() => void markSeen(n)}>
                      {t('notif.markSeen')}
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
