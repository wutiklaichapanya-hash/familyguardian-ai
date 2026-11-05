'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MOOD_LABELS, MOODS, type CheckinDTO, type Mood } from '@fg/shared';
import { api, isGrantActive } from '@/lib/api';
import { buildCheckinRequest, INITIAL_AUDIENCE, shareAvailability, type Audience, type Recipients } from '@/lib/checkin';
import { formatDate, formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { buildTrend } from '@/lib/trend';
import { MOOD_ICON } from '@/lib/visual';
import { AlertRegion, BackHome, ErrorText, LoadError, RequireRole, Status, useErrorMessage } from '@/components/ui';

function CheckinInner() {
  const { t, l, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [noteShared, setNoteShared] = useState(false);
  // Private by default (UX §1.4): the senior must actively choose to share.
  const [audience, setAudience] = useState<Audience>(INITIAL_AUDIENCE);
  const [moodError, setMoodError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<CheckinDTO | null>(null);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [history, setHistory] = useState<CheckinDTO[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const confirmRef = useRef<HTMLDivElement>(null);
  const [recipients, setRecipients] = useState<Recipients>(null);

  const loadRecipients = useCallback(() => {
    setRecipients(null);
    api
      .grants()
      .then((gs) => {
        const names = gs.filter((g) => g.category === 'checkins' && isGrantActive(g)).map((g) => g.granteeName);
        setRecipients([...new Set(names)]);
      })
      .catch(() => setRecipients('error'));
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const availability = shareAvailability(recipients);
  // If lookup fails or nobody holds access, the sharing option is unavailable; fall back to private.
  useEffect(() => {
    if (availability !== 'available' && audience === 'shared') setAudience('only_me');
  }, [availability, audience]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.myCheckins(14));
      setHistoryError('');
    } catch (e) {
      setHistoryError(errMsg(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!mood) {
      setMoodError(t('checkin.pickMood'));
      document.getElementById(`mood-${MOODS[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const req = buildCheckinRequest({ mood, note, noteShared, audience, recipients });
      const c = await api.createCheckin(req);
      setSaved(c);
      setSavedNames(!req.onlyMe && Array.isArray(recipients) ? recipients : []);
      void loadHistory();
      requestAnimationFrame(() => confirmRef.current?.focus());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  // TODO(contract): UX §2 asks for a 10-second Undo / correction of a check-in. The API (contract v0.2)
  // only exposes create + history (no delete/retract), so no Undo is shown until a real retraction
  // endpoint exists. Requested in the agent report.
  function reset() {
    setSaved(null);
    setMood(null);
    setNote('');
    setNoteShared(false);
    setAudience(INITIAL_AUDIENCE);
    setSavedNames([]);
    // The focused confirmation is removed: move focus to the first answer (WCAG 2.4.3).
    requestAnimationFrame(() => document.getElementById(`mood-${MOODS[0]}`)?.focus());
  }

  const trend = history ? buildTrend(history, 14) : null;

  return (
    <>
      <BackHome />
      <h1>{t('checkin.title')}</h1>

      {saved ? (
        <div ref={confirmRef} tabIndex={-1} className="card notice" role="status" aria-live="polite">
          <p>
            <strong>
              <span aria-hidden="true">{MOOD_ICON[saved.mood]} </span>
              {t('checkin.saved')}
            </strong>
          </p>
          <p>
            {l(MOOD_LABELS[saved.mood])} · {formatTime(saved.createdAt, locale)}
          </p>
          <p>
            {saved.onlyMe
              ? t('checkin.savedOnlyMe')
              : savedNames.length > 0
                ? t('checkin.savedSharedWith', { names: savedNames.join(', ') })
                : t('checkin.savedShared')}
          </p>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            {t('checkin.again')}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <fieldset aria-describedby={moodError ? 'mood-error' : undefined}>
            <legend>{t('checkin.moodLegend')}</legend>
            <div className="moods">
              {MOODS.map((m) => (
                <label key={m} className="mood" htmlFor={`mood-${m}`}>
                  <input
                    id={`mood-${m}`}
                    type="radio"
                    name="mood"
                    value={m}
                    checked={mood === m}
                    onChange={() => {
                      setMood(m);
                      setMoodError('');
                    }}
                  />
                  <span className="mood-icon" aria-hidden="true">{MOOD_ICON[m]}</span>
                  <span>{l(MOOD_LABELS[m])}</span>
                </label>
              ))}
            </div>
            <ErrorText id="mood-error">{moodError}</ErrorText>
          </fieldset>

          <div className="field">
            <label htmlFor="note">
              {t('checkin.note')} <span className="muted">{t('common.optional')}</span>
            </label>
            <span id="note-hint" className="hint">{t('checkin.noteHint')}</span>
            <textarea id="note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} aria-describedby="note-hint" />
          </div>

          {/* Explicit audience choice. Per-recipient selection would need a contract change (CreateCheckinReq has only onlyMe). */}
          <fieldset>
            <legend>{t('checkin.audienceLegend')}</legend>
            <label className="check" htmlFor="aud-only-me">
              <input
                id="aud-only-me"
                type="radio"
                name="audience"
                value="only_me"
                checked={audience === 'only_me'}
                onChange={() => setAudience('only_me')}
                aria-describedby="aud-only-me-hint"
              />
              <span>
                {t('checkin.onlyMe')}
                <span id="aud-only-me-hint" className="hint">{t('checkin.onlyMeHint')}</span>
              </span>
            </label>
            <label className="check" htmlFor="aud-shared">
              <input
                id="aud-shared"
                type="radio"
                name="audience"
                value="shared"
                checked={audience === 'shared'}
                disabled={availability !== 'available'}
                onChange={() => setAudience('shared')}
                aria-describedby="aud-shared-hint"
              />
              <span>
                {t('checkin.shareOption')}
                <span id="aud-shared-hint" className="hint">
                  {availability === 'loading' && t('checkin.shareLoading')}
                  {availability === 'error' && t('checkin.shareUnavailable')}
                  {availability === 'nobody' && t('checkin.shareNobody')}
                  {availability === 'available' && Array.isArray(recipients) && t('checkin.sharingDefault', { names: recipients.join(', ') })}
                </span>
              </span>
            </label>
            {availability === 'error' && (
              <button type="button" className="btn btn-secondary" onClick={loadRecipients}>
                {t('common.retry')}
              </button>
            )}
            {availability === 'nobody' && (
              <p>
                <Link href="/privacy">{t('nav.privacy')}</Link>
              </p>
            )}
            {audience === 'shared' && (
              <label className="check" htmlFor="noteShared">
                <input
                  id="noteShared"
                  type="checkbox"
                  checked={noteShared}
                  disabled={!note.trim()}
                  onChange={(e) => setNoteShared(e.target.checked)}
                  aria-describedby="noteShared-hint"
                />
                <span>
                  {t('checkin.shareNote')}
                  <span id="noteShared-hint" className="hint">{t('checkin.shareNoteHint')}</span>
                </span>
              </label>
            )}
          </fieldset>

          <AlertRegion>{error}</AlertRegion>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('checkin.saving') : t('checkin.submit')}
          </button>
        </form>
      )}

      {/* HS-02: identical help footer on every check-in view, never conditional on the answer. */}
      <aside aria-label={t('home.tile.help')} className="notice">
        <p>{t('checkin.footer')}</p>
        <div className="btn-row">
          <a className="btn btn-secondary" href="tel:1669">
            <span aria-hidden="true">📞 </span>
            {t('checkin.footerCall')}
          </a>
          <Link className="btn btn-secondary" href="/contacts">
            {t('checkin.footerContacts')}
          </Link>
        </div>
      </aside>

      <section aria-labelledby="trend-h" className="card">
        <h2 id="trend-h">{t('checkin.trendTitle')}</h2>
        <p className="muted small">{t('checkin.trendHint')}</p>
        <LoadError message={historyError} onRetry={() => void loadHistory()} />
        {!trend && !historyError && <Status>{t('common.loading')}</Status>}
        {trend && (
          <ol className="trend">
            {[...trend].reverse().map((d) => (
              <li key={d.date} className={d.mood ? '' : 'nodata'}>
                <span>{formatDate(new Date(`${d.date}T12:00:00`), locale)}</span>
                <span>
                  {d.mood ? (
                    <>
                      <span aria-hidden="true">{MOOD_ICON[d.mood]} </span>
                      {l(MOOD_LABELS[d.mood])}
                      {d.onlyMe && <span className="muted small"> · {t('checkin.onlyMeTag')}</span>}
                    </>
                  ) : (
                    t('checkin.noData')
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

export default function CheckinPage() {
  return (
    <RequireRole roles={['senior']}>
      <CheckinInner />
    </RequireRole>
  );
}
