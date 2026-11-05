'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DirectoryEntryDTO, GuardianPauseAnswers, GuardianPauseDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/i18n/format';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { SharePanel } from '@/components/SharePanel';
import { BackHome, ErrorText, RequireRole, TelLink, useErrorMessage } from '@/components/ui';

const QUESTIONS: { key: keyof GuardianPauseAnswers; label: MessageKey }[] = [
  { key: 'knowsRecipientPersonally', label: 'pause.q.knows' },
  { key: 'pressuredToActNow', label: 'pause.q.pressured' },
  { key: 'toldToKeepSecret', label: 'pause.q.secret' },
  { key: 'verifiedIndependently', label: 'pause.q.verified' },
];

type Answers = Partial<Record<keyof GuardianPauseAnswers, boolean>>;

function PauseInner() {
  const { t, l, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [amount, setAmount] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GuardianPauseDTO | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [banks, setBanks] = useState<DirectoryEntryDTO[] | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!result) return;
    api
      .directory('TH')
      .then((d) => setBanks(d.filter((e) => e.kind === 'bank_fraud' && e.verification === 'verified')))
      .catch(() => setBanks([]));
  }, [result]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const amt = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) errs.amount = t('pause.amountInvalid');
    for (const q of QUESTIONS) if (answers[q.key] === undefined) errs[q.key] = t('pause.answerRequired');
    setErrors(errs);
    setFormError('');
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(first === 'amount' ? 'amount' : `${first}-yes`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await api.guardianPause({
        amountThb: amt,
        answers: answers as GuardianPauseAnswers,
        recipientNote: note.trim() || undefined,
      });
      setResult(r);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setAmount('');
    setAnswers({});
    setNote('');
    setShowSteps(false);
  }

  const stop = result?.level === 'stop_and_verify';

  return (
    <>
      <BackHome />
      <h1>{t('pause.title')}</h1>
      <p className="notice notice-warm">
        <strong>
          <span aria-hidden="true">ⓘ </span>
          {t('pause.note')}
        </strong>
      </p>

      {!result && (
        <form onSubmit={onSubmit} noValidate>
          <p>{t('pause.intro')}</p>
          <div className="field">
            <label htmlFor="amount">{t('pause.amount')}</label>
            <input id="amount" type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount || undefined} aria-describedby={errors.amount ? 'amount-err' : undefined} />
            <ErrorText id="amount-err">{errors.amount}</ErrorText>
          </div>
          {QUESTIONS.map((q) => (
            <fieldset key={q.key} aria-describedby={errors[q.key] ? `${q.key}-err` : undefined}>
              <legend>{t(q.label)}</legend>
              <div className="yesno">
                {[true, false].map((v) => (
                  <label key={String(v)} htmlFor={`${q.key}-${v ? 'yes' : 'no'}`}>
                    <input
                      id={`${q.key}-${v ? 'yes' : 'no'}`}
                      type="radio"
                      name={q.key}
                      checked={answers[q.key] === v}
                      onChange={() => {
                        setAnswers((a) => ({ ...a, [q.key]: v }));
                        setErrors((er) => ({ ...er, [q.key]: '' }));
                      }}
                    />
                    {v ? t('common.yes') : t('common.no')}
                  </label>
                ))}
              </div>
              <ErrorText id={`${q.key}-err`}>{errors[q.key]}</ErrorText>
            </fieldset>
          ))}
          <div className="field">
            <label htmlFor="pnote">
              {t('pause.recipientNote')} <span className="muted">{t('common.optional')}</span>
            </label>
            <input id="pnote" type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div role="alert"><ErrorText>{formError}</ErrorText></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('pause.submitting') : t('pause.submit')}
          </button>
        </form>
      )}

      {result && (
        <>
          <section
            ref={resultRef}
            tabIndex={-1}
            aria-labelledby="pause-result-h"
            className={`card result ${stop ? 'result-stop notice-alert' : 'result-care'}`}
          >
            <h2 id="pause-result-h">
              <span aria-hidden="true">{stop ? '✋ ' : '⚠️ '}</span>
              {stop ? t('pause.stopTitle') : t('pause.careTitle')}
            </h2>
            <p>{stop ? t('pause.stopBody') : t('pause.careBody')}</p>
            <p className="muted">{t('pause.amountShown', { amount: formatNumber(result.amountThb, locale) })}</p>
            {result.reasons.length > 0 && (
              <>
                <h3>{t('pause.reasons')}</h3>
                <ul>
                  {result.reasons.map((r, i) => (
                    <li key={i}>{l(r)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="pause-actions-h" className="card">
            <h2 id="pause-actions-h">{t('pause.actions')}</h2>
            <div className="stack">
              <button type="button" className="btn btn-primary btn-block" aria-expanded={showSteps} aria-controls="verify-steps" onClick={() => setShowSteps((s) => !s)}>
                {t('pause.stopVerify')}
              </button>
              <ol id="verify-steps" hidden={!showSteps}>
                <li>{t('pause.step1')}</li>
                <li>{t('pause.step2')}</li>
                <li>{t('pause.step3')}</li>
              </ol>
              <Link className="btn btn-secondary btn-block" href="/contacts">
                <span aria-hidden="true">📞 </span>
                {t('pause.callFamily')}
              </Link>
              <div>
                <h3>{t('pause.bank')}</h3>
                {banks === null && <p>{t('common.loading')}</p>}
                {banks && banks.length === 0 && <p>{t('pause.bankNone')}</p>}
                {banks?.map((b) => (
                  <TelLink key={b.id} phone={b.phone} onCall={() => void api.logCall({ directoryEntryId: b.id }).catch(() => undefined)}>
                    {l(b.name)} — {b.phone}
                  </TelLink>
                ))}
              </div>
              <a className={stop ? 'btn btn-danger btn-block' : 'btn btn-secondary btn-block'} href="tel:1441">
                <span aria-hidden="true">📞 </span>
                {t('common.call1441')}
              </a>
            </div>
            <p className="muted small">{t('coercion.note')}</p>
          </section>

          <SharePanel
            category="transfer_pauses"
            title="pause.share"
            noneKey="pause.shareNone"
            onShare={async (ids) => {
              const r = await api.shareGuardianPause(result.id, ids);
              setResult(r);
            }}
          />
          <button type="button" className="btn btn-secondary btn-block" onClick={reset}>
            {t('pause.again')}
          </button>
        </>
      )}
    </>
  );
}

export default function GuardianPausePage() {
  return (
    <RequireRole roles={['senior']}>
      <PauseInner />
    </RequireRole>
  );
}
