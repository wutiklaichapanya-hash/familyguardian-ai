'use client';

import { Icon } from '@/components/icons';
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
    <article className="card person-card" aria-labelledby={headingId}>
      <div className="person-top">
        <div className="person-head">
          <span className="avatar avatar-lg" aria-hidden="true">{Array.from(card.seniorName.trim())[0] ?? '?'}</span>
          <div>
            <h2 id={headingId}>{card.seniorName}</h2>
            <p className="muted small">{card.relationship}</p>
          </div>
        </div>
        <p className="person-status">
          <span className="visually-hidden">{t('family.status')}: </span>
          <Chip tone={v.tone} icon={v.icon}>{l(DASHBOARD_LABELS[card.status])}</Chip>
        </p>
        {/* HS-03: the status only reflects what was shared. */}
        <p className="muted small">{t('family.basedOnShared')} · {t('family.noHealthAssessment')}</p>
        <p className="muted small">
          {card.lastUpdatedAt ? t('family.lastUpdate', { time: formatDateTime(card.lastUpdatedAt, locale) }) : t('family.never')}
        </p>
      </div>
      <div className="person-body">

      {nothingShared ? (
        <p>{t('family.noShared')}</p>
      ) : (
        <>
          <p className="small">
            {t('family.sharedCats', { list: card.visibleCategories.map((c) => t(`cat.${c}`)).join(', ') })}
          </p>

          {sees('checkins') && (
            <section aria-labelledby={`${headingId}-ci`}>
              <h3 id={`${headingId}-ci`}><span className="ibadge ibadge-xs fc-amber"><Icon name="sun" /></span>{t('family.latestCheckin')}</h3>
              {card.latestCheckin && isToday(card.latestCheckin.at) ? (
                <p className="mood-line">
                  <Icon name={MOOD_ICON[card.latestCheckin.mood]} size="1.4em" />
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
              <h3 id={`${headingId}-al`}><span className="ibadge ibadge-xs fc-rose"><Icon name="bell" /></span>{t('family.alerts')}</h3>
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
              <h3 id={`${headingId}-sc`}><span className="ibadge ibadge-xs fc-blue"><Icon name="shieldSearch" /></span>{t('family.scams')}</h3>
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
              <h3 id={`${headingId}-tp`}><span className="ibadge ibadge-xs fc-purple"><Icon name="pauseHand" /></span>{t('family.pauses')}</h3>
              <ul className="list-plain">
                {card.sharedTransferPauses.map((p) => (
                  <li key={p.id}>
                    <Chip tone={p.level === 'stop_and_verify' ? 'alert' : 'warm'} icon={p.level === "stop_and_verify" ? "pauseHand" : "alert"}>
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
      </div>
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
      <div className="page-head">
        <span className="ibadge fc-teal"><Icon name="users" /></span>
        <h1>{t('family.title')}</h1>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <Status>{t('common.loading')}</Status>}
      {data && data.seniors.length === 0 && (
        <p>
          {t('family.empty')} <Link href="/invite/accept">{t('nav.acceptInvite')}</Link>
        </p>
      )}
      {data?.seniors.map((c) => <SeniorCard key={c.seniorId} card={c} />)}
      {data && data.seniors.length > 0 && (
        <p className="owner-banner">
          <span className="ibadge fc-green"><Icon name="users" /></span>
          <span>{t('family.ownerBanner')}</span>
        </p>
      )}
      <ul className="rows">
        <li>
          <Link className="row-link" href="/notifications">
            <span className="ibadge ibadge-sm fc-blue"><Icon name="bell" /></span>
            <span className="row-text">{t('nav.notifications')}</span>
            <Icon name="chevronRight" className="row-chev" />
          </Link>
        </li>
      </ul>
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
