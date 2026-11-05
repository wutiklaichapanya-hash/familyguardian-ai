'use client';

import { useEffect, useState } from 'react';
import type { SessionDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { Chip, Status, useErrorMessage } from './ui';

/** "Signed-in devices" (GET/DELETE /auth/sessions). */
export function SessionsSection() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [sessions, setSessions] = useState<SessionDTO[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    api.sessions().then(setSessions).catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut(s: SessionDTO) {
    try {
      await api.deleteSession(s.id);
      if (s.current) {
        window.location.assign('/');
        return;
      }
      setSessions((xs) => (xs ?? []).filter((x) => x.id !== s.id));
      setStatus(t('sessions.signedOut'));
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  return (
    <section aria-labelledby="sessions-h" className="card">
      <h2 id="sessions-h">{t('sessions.title')}</h2>
      {error && <p>{error}</p>}
      {!sessions && !error && <p>{t('common.loading')}</p>}
      {sessions && sessions.length === 0 && <p>{t('sessions.empty')}</p>}
      {sessions && sessions.length > 0 && (
        <ul className="list-plain">
          {sessions.map((s) => (
            <li key={s.id}>
              <p>
                {s.userAgent || t('sessions.unknownDevice')} {s.current && <Chip tone="brand">{t('sessions.current')}</Chip>}
              </p>
              <p className="muted small">
                {t('sessions.meta', { created: formatDateTime(s.createdAt, locale), last: formatDateTime(s.lastSeenAt, locale) })}
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => void signOut(s)}>
                {t('sessions.signOut')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Status>{status}</Status>
    </section>
  );
}
