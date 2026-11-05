'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { RISK_LABELS, type ScamAssessmentDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { defang } from '@/lib/defang';
import { useI18n } from '@/lib/i18n';
import { RISK_VISUAL } from '@/lib/visual';
import { SharePanel } from '@/components/SharePanel';
import { BackHome, Chip, ErrorText, RequireRole, Status, useErrorMessage } from '@/components/ui';

function ScamInner() {
  const { t, l, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScamAssessmentDTO | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!text.trim() && !url.trim() && !phone.trim()) {
      setError(t('scam.needInput'));
      document.getElementById('scam-text')?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await api.scamCheck({
        text: text.trim() || undefined,
        url: url.trim() || undefined,
        phone: phone.trim() || undefined,
        locale,
      });
      setResult(r);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setText('');
    setUrl('');
    setPhone('');
    requestAnimationFrame(() => document.getElementById('scam-text')?.focus());
  }

  return (
    <>
      <BackHome />
      <h1>{t('scam.title')}</h1>
      <p>{t('scam.intro')}</p>
      <p>
        <Link href="/guardian-pause">{t('scam.pauseLink')}</Link>
      </p>

      {!result && (
        <form onSubmit={onSubmit} noValidate className="card">
          <div className="field">
            <label htmlFor="scam-text">{t('scam.text')}</label>
            <span id="scam-text-hint" className="hint">{t('scam.textHint')}</span>
            <textarea
              id="scam-text"
              value={text}
              maxLength={5000}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={`scam-text-hint${error ? ' scam-error' : ''}`}
            />
          </div>
          <div className="field">
            <label htmlFor="scam-url">{t('scam.url')}</label>
            <span id="scam-url-hint" className="hint">{t('scam.urlHint')}</span>
            {/* type=text, not url: we never treat it as a navigable link */}
            <input id="scam-url" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} aria-describedby="scam-url-hint" />
          </div>
          <div className="field">
            <label htmlFor="scam-phone">{t('scam.phone')}</label>
            <input id="scam-phone" type="text" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div role="alert">
            <ErrorText id="scam-error">{error}</ErrorText>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('scam.checking') : t('scam.submit')}
          </button>
        </form>
      )}
      <Status>{busy ? t('scam.checking') : ''}</Status>

      {result && (
        <>
          <section ref={resultRef} tabIndex={-1} aria-labelledby="result-h" className={`card result result-${result.risk}`}>
            <h2 id="result-h">{t('scam.resultTitle')}</h2>
            <p>
              <Chip tone={RISK_VISUAL[result.risk].tone} icon={RISK_VISUAL[result.risk].icon}>
                {l(RISK_LABELS[result.risk])}
              </Chip>
            </p>
            <p>{l(result.explanation)}</p>

            <h3>{t('scam.why')}</h3>
            {result.evidence.length === 0 ? (
              <p>{t('scam.noEvidence')}</p>
            ) : (
              <ul>
                {result.evidence.map((ev, i) => (
                  <li key={`${ev.signal}-${i}`}>
                    <strong>{t(`signal.${ev.signal}`)}</strong>
                    {ev.quote && <blockquote className="quote">“{defang(ev.quote)}”</blockquote>}
                    <span>{l(ev.explanation)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3>{t('scam.notSure')}</h3>
            <p>{l(result.uncertainty)}</p>

            <h3>{t('scam.steps')}</h3>
            <ol>
              {result.verificationSteps.map((s, i) => (
                <li key={i}>{l(s)}</li>
              ))}
            </ol>

            {result.submittedText && (
              <details>
                <summary>{t('scam.submitted')}</summary>
                <blockquote className="quote">{defang(result.submittedText)}</blockquote>
              </details>
            )}

            <div className="stack">
              <a className={result.risk === 'high_risk' ? 'btn btn-danger btn-block' : 'btn btn-secondary btn-block'} href="tel:1441">
                <span aria-hidden="true">📞 </span>
                {t('common.call1441')}
              </a>
            </div>
            <p className="muted small">{t('scam.engine', { version: result.engine.version })}</p>
          </section>

          <SharePanel
            category="scam_checks"
            title="scam.share"
            noneKey="scam.shareNone"
            onShare={async (ids) => {
              const r = await api.shareScamCheck(result.id, ids);
              setResult(r);
            }}
          />
          <button type="button" className="btn btn-secondary btn-block" onClick={reset}>
            {t('scam.new')}
          </button>
        </>
      )}
    </>
  );
}

export default function ScamCheckPage() {
  return (
    <RequireRole roles={['senior']}>
      <ScamInner />
    </RequireRole>
  );
}
