'use client';

import { Icon } from '@/components/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AlertDTO, ContactDTO } from '@fg/shared';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { DeliveryList } from '@/components/DeliveryList';
import { AlertRegion, Chip, RequireRole, Status, TelLink, useErrorMessage } from '@/components/ui';
import { defang } from '@/lib/defang';

function AlertInner() {
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [alert, setAlert] = useState<AlertDTO | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ackError, setAckError] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [seniorContact, setSeniorContact] = useState<ContactDTO | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    api
      .alert(id)
      .then((a) => {
        setAlert(a);
        // A phone number for the senior is only available if it is in the viewer's own contacts.
        api
          .contacts()
          .then((cs) => setSeniorContact(cs.find((c) => c.linkedUserId === a.seniorId) ?? null))
          .catch(() => setSeniorContact(null));
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? t('alert.notFound') : errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function ack() {
    if (!alert) return;
    setBusy(true);
    setAckError('');
    try {
      const a = await api.ackAlert(alert.id);
      setAlert(a);
    } catch (e) {
      setAckError(e instanceof ApiError && e.status === 404 ? t('alert.notFound') : errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="back-link">
        <Link href="/family">
          <Icon name="chevronLeft" size="1.2em" />
          {t('nav.dashboard')}
        </Link>
      </p>
      <h1>{t('alert.title')}</h1>
      {error && <p role="alert">{error}</p>}
      {!alert && !error && <Status>{t('common.loading')}</Status>}
      {alert && (
        <>
          <article className="card">
            <h2>{t(`alert.kind.${alert.kind}`)}</h2>
            <dl className="kv">
              <dt>{t('alert.from')}</dt>
              <dd>{alert.seniorName}</dd>
              <dt>{t('alert.when')}</dt>
              <dd>{formatDateTime(alert.createdAt, locale)}</dd>
              <dt>{t('alert.origin')}</dt>
              <dd>
                <Chip tone="neutral" icon={alert.origin === 'user_requested' ? "handRaised" : "info"}>
                  {alert.origin === 'user_requested'
                    ? t('alert.origin.user_requested', { name: alert.seniorName })
                    : t('alert.origin.system_warning')}
                </Chip>
              </dd>
            </dl>
            {/* Untrusted text: rendered inert (no link or tel: detection). */}
            <p>{defang(alert.summary)}</p>
          </article>

          <section aria-labelledby="told-h" className="card">
            <h2 id="told-h">{t('alert.whoTold')}</h2>
            <DeliveryList deliveries={alert.deliveries} />
          </section>

          {/* Acknowledgement and call feedback live in separate regions so one never hides the other. */}
          <div role="status" aria-live="polite">
            {alert.acknowledgedBy && (
              <p className="notice">
                <strong>
                  {t('alert.ackedBy', { name: alert.acknowledgedBy.name, time: formatTime(alert.acknowledgedBy.at, locale) })}
                </strong>
              </p>
            )}
          </div>
          <AlertRegion>{ackError}</AlertRegion>
          <Status>
            {callStatus && (
              <>
                <strong>{callStatus}</strong>
                <br />
                <span className="small">{t('contacts.startedNote')}</span>
              </>
            )}
          </Status>

          <div className="stack">
            {!alert.acknowledgedBy && (
              <button type="button" className="btn btn-primary btn-block" onClick={ack} disabled={busy}>
                {busy ? t('alert.acking') : t('alert.ack')}
              </button>
            )}
            {seniorContact ? (
              <TelLink phone={seniorContact.phone} onCall={() => setCallStatus(t('alert.callStarted'))}>
                {t('alert.callSenior', { name: alert.seniorName })}
              </TelLink>
            ) : (
              seniorContact === null && <p className="muted">{t('alert.noPhone', { name: alert.seniorName })}</p>
            )}
            <a className="btn btn-secondary btn-block" href="tel:1669">
              <Icon name="phone" size="1.2em" />
              {t('common.call1669')}
            </a>
          </div>
        </>
      )}
    </>
  );
}

export default function AlertPage() {
  return (
    <RequireRole roles={['family', 'caregiver']}>
      <AlertInner />
    </RequireRole>
  );
}
