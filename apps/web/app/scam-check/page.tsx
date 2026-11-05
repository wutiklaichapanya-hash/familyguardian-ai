'use client';

import { Icon, type IconName } from '@/components/icons';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { RISK_LABELS, type ScamAssessmentDTO } from '@fg/shared';
import { api } from '@/lib/api';
import { containsPhoneNumber, defang } from '@/lib/defang';
import { useI18n } from '@/lib/i18n';
import { RISK_VISUAL } from '@/lib/visual';
import { SharePanel } from '@/components/SharePanel';
import { AlertRegion, BackHome, Chip, RequireRole, Status, useErrorMessage } from '@/components/ui';

// Decorative icon per evidence signal; the signal name is always shown as text beside it.
const SIGNAL_ICON: Partial<Record<string, IconName>> = {
  impersonation: 'user',
  urgency: 'clock',
  secrecy: 'lock',
  credential_request: 'lock',
  otp_request: 'lock',
  suspicious_link: 'link',
  lookalike_domain: 'link',
  link_shortener: 'link',
  advance_fee: 'banknote',
  investment_promise: 'banknote',
  payment_request: 'banknote',
  prize_or_lottery: 'banknote',
  remote_access_app: 'smartphone',
  threat_or_fear: 'alert',
  romance: 'heart',
  unknown_number_pattern: 'phone',
};

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
      <div className="page-head">
        <span className="ibadge fc-blue"><Icon name="shieldSearch" /></span>
        <h1>{t('scam.title')}</h1>
      </div>
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
            <input id="scam-url" type="text" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} value={url} onChange={(e) => setUrl(e.target.value)} aria-describedby="scam-url-hint" />
          </div>
          <div className="field">
            <label htmlFor="scam-phone">{t('scam.phone')}</label>
            <input id="scam-phone" type="text" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <AlertRegion id="scam-error">{error}</AlertRegion>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('scam.checking') : t('scam.submit')}
          </button>
        </form>
      )}
      <Status>{busy ? t('scam.checking') : ''}</Status>

      {result && (
        <>
          <section ref={resultRef} tabIndex={-1} aria-labelledby="result-h" className={`card result result-${result.risk}`}>
            <div className="verdict">
              <span className="verdict-icon">
                <Icon name={RISK_VISUAL[result.risk].icon} />
              </span>
              <h2 id="result-h" className="verdict-eyebrow">{t('scam.resultTitle')}</h2>
              <p className="verdict-title">{l(RISK_LABELS[result.risk])}</p>
            </div>
            <p className="verdict-body">{l(result.explanation)}</p>

            {/* Order: verdict → uncertainty → actions → evidence → full text (Codex UX P0 #8). */}
            <div className="verdict-unsure">
              <h3>{t('scam.notSure')}</h3>
              <p>{l(result.uncertainty)}</p>
            </div>
          </section>

          <section aria-labelledby="scam-actions-h" className="card">
            <h2 id="scam-actions-h">{t('pause.actions')}</h2>
            <div className="stack">
              {/* Always available, whether or not anyone holds a sharing grant. */}
              <Link className="btn btn-primary btn-block" href="/contacts">
                <Icon name="phone" size="1.2em" />
                {t('pause.callFamily')}
              </Link>
              <a className={result.risk === 'high_risk' ? 'btn btn-danger btn-block' : 'btn btn-secondary btn-block'} href="tel:1441">
                <Icon name="phone" size="1.2em" />
                {t('common.call1441')}
              </a>
            </div>
          </section>

          <SharePanel
            category="scam_checks"
            title="scam.share"
            noneKey="scam.shareNone"
            includesKey="scam.shareIncludes"
            onShare={async (ids) => {
              const r = await api.shareScamCheck(result.id, ids);
              setResult(r);
            }}
          />

          <section aria-labelledby="scam-why-h" className="card">
            <h2 id="scam-why-h">{t('scam.why')}</h2>
            {result.evidence.length === 0 ? (
              <p>{t('scam.noEvidence')}</p>
            ) : (
              <ul className="evidence">
                {result.evidence.map((ev, i) => (
                  <li key={`${ev.signal}-${i}`}>
                    <span className="ev-icon"><Icon name={SIGNAL_ICON[ev.signal] ?? 'alert'} /></span>
                    <strong className="ev-title">{t(`signal.${ev.signal}`)}</strong>
                    {ev.quote && (
                      <>
                        {/* Untrusted text: labelled as coming from the message, defanged, never a link or tel:. */}
                        <span className="hint">{t('scam.quoteFrom')}</span>
                        <blockquote className="quote">“{defang(ev.quote)}”</blockquote>
                        {containsPhoneNumber(ev.quote) && (
                          <p className="notice notice-warm small">
                            <strong>{t('scam.numberWarn')}</strong>
                          </p>
                        )}
                      </>
                    )}
                    <span>{l(ev.explanation)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3>{t('scam.steps')}</h3>
            <ol className="steps">
              {result.verificationSteps.map((s, i) => (
                <li key={i}>{l(s)}</li>
              ))}
            </ol>

            {result.submittedText && (
              <details>
                <summary>{t('scam.submitted')}</summary>
                <blockquote className="quote">{defang(result.submittedText)}</blockquote>
                {containsPhoneNumber(result.submittedText) && <p className="small">{t('scam.numberWarn')}</p>}
              </details>
            )}
            <p className="muted small">{t('scam.engine', { version: result.engine.version })}</p>
          </section>

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
