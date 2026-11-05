'use client';

import { useEffect, useState } from 'react';
import type { PlanDTO, SubscriptionDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatLongDate, formatNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { BackHome, ConfirmDialog, RequireRole, Status, useErrorMessage } from '@/components/ui';

// P1 sandbox. If the billing endpoints are not available, say so honestly.
function BillingInner() {
  const { t, l, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [plans, setPlans] = useState<PlanDTO[] | null>(null);
  const [sub, setSub] = useState<SubscriptionDTO | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    api
      .plans()
      .then((p) => {
        setPlans(p);
        api.subscription().then(setSub).catch(() => setSub(null));
      })
      .catch(() => setUnavailable(true));
  }, []);

  async function choose(p: PlanDTO) {
    try {
      const r = await api.checkout(p.id);
      setStatus(t('billing.checkout', { url: r.checkoutUrl }));
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  async function cancel() {
    setConfirmCancel(false);
    try {
      setSub(await api.cancelSubscription());
      setStatus(t('billing.canceled'));
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  return (
    <>
      <BackHome />
      <h1>{t('billing.title')}</h1>
      <p className="notice notice-warm"><strong>{t('billing.sandbox')}</strong></p>
      {unavailable && (
        <div className="card">
          <h2>{t('billing.notEnabled')}</h2>
          <p>{t('billing.notEnabledBody')}</p>
        </div>
      )}
      {!plans && !unavailable && <Status>{t('common.loading')}</Status>}
      {plans && (
        <>
          <p className="muted small">{t('billing.hypothesis')}</p>
          <p>
            {sub
              ? t('billing.current', { plan: plans.find((p) => p.id === sub.planId) ? l(plans.find((p) => p.id === sub.planId)!.name) : sub.planId, status: t(`sub.${sub.status}`) })
              : t('billing.none')}
            {sub && <span className="muted small"> · {formatLongDate(sub.currentPeriodEnd, locale)}</span>}
          </p>
          {sub && sub.status !== 'canceled' && sub.status !== 'refunded' && (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmCancel(true)}>
              {t('billing.cancel')}
            </button>
          )}
          <ul className="list-plain">
            {plans.map((p) => (
              <li key={p.id} className="card">
                <h2>{l(p.name)}</h2>
                <p className="stat">{t('billing.perMonth', { price: formatNumber(p.priceThbMonthly, locale) })}</p>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <button type="button" className="btn btn-primary" onClick={() => void choose(p)}>
                  {t('billing.choose')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Status>{status}</Status>
      <ConfirmDialog open={confirmCancel} title={t('billing.cancelConfirm')} confirmLabel={t('billing.cancel')} onConfirm={() => void cancel()} onCancel={() => setConfirmCancel(false)} />
    </>
  );
}

export default function BillingPage() {
  return (
    <RequireRole roles={['senior', 'family', 'caregiver']}>
      <BillingInner />
    </RequireRole>
  );
}
