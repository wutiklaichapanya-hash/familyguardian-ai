'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MOOD_LABELS, MOODS, type CheckinDTO, type Mood } from '@fg/shared';
import { api, isGrantActive } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n';
import { buildTrend } from '@/lib/trend';
import { MOOD_ICON } from '@/lib/visual';
import { BackHome, ErrorText, RequireRole, Status, useErrorMessage } from '@/components/ui';

function CheckinInner() {
  const { t, l, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [noteShared, setNoteShared] = useState(false);
  const [onlyMe, setOnlyMe] = useState(false);
  const [moodError, setMoodError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<CheckinDTO | null>(null);
  const [history, setHistory] = useState<CheckinDTO[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const confirmRef = useRef<HTMLDivElement>(null);
  const [checkinGrantees, setCheckinGrantees] = useState<string[] | null>(null);

  useEffect(() => {
    api
      .grants()
      .then((gs) => {
        const names = gs.filter((g) => g.category === 'checkins' && isGrantActive(g)).map((g) => g.granteeName);
        setCheckinGrantees([...new Set(names)]);
      })
      .catch(() => setCheckinGrantees(null));
  }, []);

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
      const c = await api.createCheckin({
        mood,
        note: note.trim() || undefined,
        noteShared: !onlyMe && noteShared && !!note.trim(),
        onlyMe,
      });
      setSaved(c);
      void loadHistory();
      requestAnimationFrame(() => confirmRef.current?.focus());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSaved(null);
    setMood(null);
    setNote('');
    setNoteShared(false);
    setOnlyMe(false);
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
              : checkinGrantees && checkinGrantees.length > 0
                ? t('checkin.savedSharedWith', { names: checkinGrantees.join(', ') })
                : checkinGrantees
                  ? t('checkin.savedOnlyMe')
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

          <fieldset>
            <legend>{t('nav.privacy')}</legend>
            <label className="check" htmlFor="onlyMe">
              <input id="onlyMe" type="checkbox" checked={onlyMe} onChange={(e) => setOnlyMe(e.target.checked)} aria-describedby="onlyMe-hint" />
              <span>
                {t('checkin.onlyMe')}
                <span id="onlyMe-hint" className="hint">{t('checkin.onlyMeHint')}</span>
              </span>
            </label>
            <label className="check" htmlFor="noteShared">
              <input
                id="noteShared"
                type="checkbox"
                checked={noteShared && !onlyMe}
                disabled={onlyMe || !note.trim()}
                onChange={(e) => setNoteShared(e.target.checked)}
                aria-describedby="noteShared-hint"
              />
              <span>
                {t('checkin.shareNote')}
                <span id="noteShared-hint" className="hint">{t('checkin.shareNoteHint')}</span>
              </span>
            </label>
            <p className="hint">{t('checkin.sharingDefault')}</p>
          </fieldset>

          <div role="alert">
            <ErrorText>{error}</ErrorText>
          </div>
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
        {historyError && <p>{historyError}</p>}
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
