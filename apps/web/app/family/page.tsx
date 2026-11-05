'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DASHBOARD_LABELS, MOOD_LABELS, NO_DATA_LABEL, RISK_LABELS, type DashboardDTO, type DashboardSeniorCard } from '@fg/shared';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { isToday } from '@/lib/trend';
import { DASHBOARD_VISUAL, MOOD_ICON, RISK_VISUAL } from '@/lib/visual';
import { SessionsSection } from '@/components/SessionsSection';
import { Chip, RequireRole, Status, useErrorMessage } from '@/components/ui';

function SeniorCard({ card }: { card: DashboardSeniorCard }) {
  const { t, l, locale } = useI18n();
  const v = DASHBOARD_VISUAL[card.status];
  const sees = (c: DashboardSeniorCard['visibleCategories'][number]) => card.visibleCategories.includes(c);
  const nothingShared = card.visibleCategories.length === 0 || card.status === 'not_shared';
  const headingId = `senior-${card.seniorId}`;

  return (
    <article className="card" aria-labelledby={headingId}>
      <h2 id={headingId}>{card.seniorName}</h2>
      <p className="muted small">{card.relationship}</p>
      <p>
        <span className="visually-hidden">{t('family.status')}: </span>
        <Chip tone={v.tone} icon={v.icon}>{l(DASHBOARD_LABELS[card.status])}</Chip>
      </p>
      {/* HS-03: the status only reflects what was shared. */}
      <p className="muted small">{t('family.basedOnShared')} · {t('family.noHealthAssessment')}</p>
      <p className="muted small">
        {card.lastUpdatedAt ? t('family.lastUpdate', { time: formatDateTime(card.lastUpdatedAt, locale) }) : t('family.never')}
      </p>

      {nothingShared ? (
        <p>{t('family.noShared')}</p>
      ) : (
        <>
          <p className="small">
            {t('family.sharedCats', { list: card.visibleCategories.map((c) => t(`cat.${c}`)).join(', ') })}
          </p>

          {sees('checkins') && (
            <section aria-labelledby={`${headingId}-ci`}>
              <h3 id={`${headingId}-ci`}>{t('family.latestCheckin')}</h3>
              {card.latestCheckin && isToday(card.latestCheckin.at) ? (
                <p>
                  <span aria-hidden="true">{MOOD_ICON[card.latestCheckin.mood]} </span>
                  {l(MOOD_LABELS[card.latestCheckin.mood])} · {formatDateTime(card.latestCheckin.at, locale)}
                </p>
              ) : (
                <>
                  <p className="muted">{l(NO_DATA_LABEL)}</p>
                  {card.latestCheckin && (
                    <p className="small muted">
                      {l(MOOD_LABELS[card.latestCheckin.mood])} · {formatDateTime(card.latestCheckin.at, locale)}
                    </p>
                  )}
                </>
              )}
              {card.latestCheckin?.note && <p className="small">{t('family.note', { note: card.latestCheckin.note })}</p>}
            </section>
          )}

          {card.pendingAlerts && (
            <section aria-labelledby={`${headingId}-al`}>
              <h3 id={`${headingId}-al`}>{t('family.alerts')}</h3>
              {card.pendingAlerts.length === 0 ? (
                <p className="muted">{t('family.noAlerts')}</p>
              ) : (
                <ul className="list-plain">
                  {card.pendingAlerts.map((a) => (
                    <li key={a.id} className="row">
                      <span>
                        {t(`alert.kind.${a.kind}`)} · {formatDateTime(a.createdAt, locale)}
                      </span>
                      <Link className="btn btn-secondary" href={`/alerts/${encodeURIComponent(a.id)}`}>
                        {t('family.viewAlert')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {sees('scam_checks') && card.sharedScamChecks && card.sharedScamChecks.length > 0 && (
            <section aria-labelledby={`${headingId}-sc`}>
              <h3 id={`${headingId}-sc`}>{t('family.scams')}</h3>
              <ul className="list-plain">
                {card.sharedScamChecks.map((s) => (
                  <li key={s.id}>
                    <Chip tone={RISK_VISUAL[s.risk].tone} icon={RISK_VISUAL[s.risk].icon}>{l(RISK_LABELS[s.risk])}</Chip>
                    <p className="small">{l(s.explanation)}</p>
                    <p className="muted small">{formatDateTime(s.createdAt, locale)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sees('transfer_pauses') && card.sharedTransferPauses && card.sharedTransferPauses.length > 0 && (
            <section aria-labelledby={`${headingId}-tp`}>
              <h3 id={`${headingId}-tp`}>{t('family.pauses')}</h3>
              <ul className="list-plain">
                {card.sharedTransferPauses.map((p) => (
                  <li key={p.id}>
                    <Chip tone={p.level === 'stop_and_verify' ? 'alert' : 'warm'} icon={p.level === 'stop_and_verify' ? '✋' : '⚠️'}>
                      {t(`level.${p.level}`)}
                    </Chip>{' '}
                    <span>{t(`bucket.${p.amountBucket}`)}</span>
                    <p className="muted small">{formatDateTime(p.createdAt, locale)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </article>
  );
}

function FamilyInner() {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1>{t('family.title')}</h1>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <Status>{t('common.loading')}</Status>}
      {data && data.seniors.length === 0 && (
        <p>
          {t('family.empty')} <Link href="/invite/accept">{t('nav.acceptInvite')}</Link>
        </p>
      )}
      {data?.seniors.map((c) => <SeniorCard key={c.seniorId} card={c} />)}
      <p>
        <Link href="/notifications">{t('nav.notifications')}</Link>
      </p>
      <SessionsSection />
    </>
  );
}

export default function FamilyPage() {
  return (
    <RequireRole roles={['family', 'caregiver']}>
      <FamilyInner />
    </RequireRole>
  );
}
