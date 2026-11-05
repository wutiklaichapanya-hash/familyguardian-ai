'use client';

import { useEffect, useState } from 'react';
import type { DirectoryEntryDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { FALLBACK_DIRECTORY } from '@/lib/fallbackDirectory';
import { formatLongDate } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { BackHome, Chip, Status, TelLink } from '@/components/ui';

const ORDER: DirectoryEntryDTO['kind'][] = ['medical_emergency', 'police', 'anti_scam', 'social_support', 'bank_fraud'];

// Public page: must work without sign-in and without the API (static fallback).
export default function EmergencyPage() {
  const { t, l, locale } = useI18n();
  const { me, status: sessionStatus } = useSession();
  const [entries, setEntries] = useState<DirectoryEntryDTO[]>(FALLBACK_DIRECTORY);
  const [offline, setOffline] = useState(false);
  const [callMsg, setCallMsg] = useState('');

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!me) {
      setEntries(FALLBACK_DIRECTORY);
      return;
    }
    api
      .directory('TH')
      .then((d) => {
        // Bank numbers are shown only once verified by a human (B4).
        const usable = d.filter((e) => e.kind !== 'bank_fraud' || e.verification === 'verified');
        setEntries(usable.length ? usable : FALLBACK_DIRECTORY);
        setOffline(usable.length === 0);
      })
      .catch(() => {
        setEntries(FALLBACK_DIRECTORY);
        setOffline(true);
      });
  }, [me, sessionStatus]);

  const sorted = [...entries].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return (
    <>
      <BackHome />
      <h1>
        <span aria-hidden="true">🆘 </span>
        {t('emergency.title')}
      </h1>
      <p className="notice notice-alert">
        <strong>{t('emergency.notAuto')}</strong>
      </p>
      {offline && <p className="muted small">{t('emergency.offline')}</p>}
      <ul className="list-plain">
        {sorted.map((e) => (
          <li key={e.id} className="card">
            <h2>{l(e.name)}</h2>
            <p>{l(e.purpose)}</p>
            <p>
              {e.verification === 'needs_human_verification' ? (
                <Chip tone="neutral" icon="⏳">{t('emergency.unverified')}</Chip>
              ) : (
                e.verifiedAt && <span className="muted small">{t('emergency.verifiedOn', { date: formatLongDate(e.verifiedAt, locale) })}</span>
              )}
            </p>
            <TelLink
              phone={e.phone}
              className={e.kind === 'medical_emergency' ? 'btn btn-danger btn-block' : 'btn btn-secondary btn-block'}
              onCall={() => {
                setCallMsg(t('emergency.started', { name: l(e.name) }));
                if (me && !e.id.startsWith('fallback-')) void api.logCall({ directoryEntryId: e.id }).catch(() => undefined);
              }}
            >
              {t('emergency.callBtn', { phone: e.phone })}
            </TelLink>
          </li>
        ))}
      </ul>
      <Status>{callMsg}</Status>
      <p className="muted small">{t('coercion.note')}</p>
    </>
  );
}
