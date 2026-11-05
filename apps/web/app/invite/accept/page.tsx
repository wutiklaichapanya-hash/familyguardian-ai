'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { ErrorText, Status, useErrorMessage } from '@/components/ui';

/** Read the invite token from the link (#token=… preferred, ?token=… accepted) and remove it from the address bar. */
function takeTokenFromUrl(): string {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const token = hash.get('token') ?? query.get('token') ?? '';
  if (token) window.history.replaceState(null, '', window.location.pathname);
  return token;
}

export default function AcceptInvitePage() {
  const { t } = useI18n();
  const { me, status: sessionStatus } = useSession();
  const errMsg = useErrorMessage();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    const tk = takeTokenFromUrl();
    if (tk) {
      setToken(tk);
      // Keep it for this tab only, so the sign-in round trip does not lose it.
      try {
        window.sessionStorage.setItem('fg-invite-token', tk);
      } catch {
        /* ignore */
      }
    } else {
      try {
        setToken(window.sessionStorage.getItem('fg-invite-token') ?? '');
      } catch {
        /* ignore */
      }
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError(t('accept.tokenRequired'));
      return;
    }
    setBusy(true);
    try {
      // Token goes in the request BODY only.
      const res = await api.acceptInvite({ token: token.trim() });
      try {
        window.sessionStorage.removeItem('fg-invite-token');
      } catch {
        /* ignore */
      }
      setDone(t('accept.done', { name: res.seniorFirstName }));
      setToken('');
    } catch (err) {
      if (err instanceof ApiError && [400, 404, 409, 410, 429].includes(err.status)) setError(t('accept.failed'));
      else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{t('accept.title')}</h1>
      {sessionStatus !== 'loading' && !me && (
        <div className="notice notice-warm">
          <p>{t('accept.loginFirst')}</p>
          <Link className="btn btn-primary" href="/login">
            {t('common.goLogin')}
          </Link>
        </div>
      )}
      <Status className="notice">{done}</Status>
      {me && !done && (
        <form onSubmit={onSubmit} noValidate className="card">
          <p className="muted small">{t('accept.intro')}</p>
          <div className="field">
            <label htmlFor="token">{t('accept.token')}</label>
            <input
              id="token"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'token-err' : undefined}
            />
          </div>
          <div role="alert"><ErrorText id="token-err">{error}</ErrorText></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {t('accept.submit')}
          </button>
        </form>
      )}
      {done && (
        <p>
          <Link href="/family">{t('nav.dashboard')}</Link>
        </p>
      )}
    </>
  );
}
