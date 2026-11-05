'use client';

import { useEffect, useState } from 'react';
import { NOTIFICATION_STATES, ROLES, type AdminOverviewDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { RequireRole, Status, useErrorMessage } from '@/components/ui';

// Operational counts only — this page never requests or renders personal content.
function AdminInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [data, setData] = useState<AdminOverviewDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminOverview().then(setData).catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = (x: number | undefined) => formatNumber(x ?? 0, locale);

  return (
    <>
      <h1>{t('admin.title')}</h1>
      <p className="muted">{t('admin.note')}</p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <Status>{t('common.loading')}</Status>}
      {data && (
        <>
          <div className="stat-grid">
            <div className="card"><p className="small">{t('admin.families')}</p><p className="stat">{n(data.families)}</p></div>
            <div className="card"><p className="small">{t('admin.failed24')}</p><p className="stat">{n(data.failedDeliveriesLast24h)}</p></div>
            <div className="card"><p className="small">{t('admin.dirUnverified')}</p><p className="stat">{n(data.directoryUnverified)}</p></div>
          </div>
          <section className="card" aria-labelledby="users-h">
            <h2 id="users-h">{t('admin.users')}</h2>
            <dl className="kv">
              {ROLES.map((r) => (
                <div key={r} style={{ display: 'contents' }}>
                  <dt>{t(`role.${r}`)}</dt>
                  <dd>{n(data.users[r])}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card" aria-labelledby="notifs-h">
            <h2 id="notifs-h">{t('admin.notifs')}</h2>
            <dl className="kv">
              {NOTIFICATION_STATES.map((s) => (
                <div key={s} style={{ display: 'contents' }}>
                  <dt>{t(`chip.${s}`)}</dt>
                  <dd>{n(data.notifications[s])}</dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="muted small">{t('admin.generated', { time: formatDateTime(data.generatedAt, locale) })}</p>
        </>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <RequireRole roles={['admin', 'org_admin']}>
      <AdminInner />
    </RequireRole>
  );
}
