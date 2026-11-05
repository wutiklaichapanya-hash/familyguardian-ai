'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { homePathFor, useSession } from '@/lib/session';
import { ErrorText, Status, useErrorMessage } from '@/components/ui';

// Synthetic demo accounts from the common brief. Shown only in demo mode.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
const DEMO_ACCOUNTS: { email: string; password: string; name: string; role: MessageKey }[] = [
  { email: 'somsri@demo.fg', password: 'Demo-Senior-2026', name: 'สมศรี (Somsri)', role: 'login.demo.senior' },
  { email: 'nok@demo.fg', password: 'Demo-Family-2026', name: 'นก (Nok)', role: 'login.demo.family' },
  { email: 'anan@demo.fg', password: 'Demo-Family-2026', name: 'อนันต์ (Anan)', role: 'login.demo.familyNoGrant' },
  { email: 'pim@demo.fg', password: 'Demo-Care-2026', name: 'พิม (Pim)', role: 'login.demo.caregiver' },
  { email: 'admin@demo.fg', password: 'Demo-Admin-2026', name: 'Admin', role: 'login.demo.admin' },
];

export default function LoginPage() {
  const { t } = useI18n();
  const { setMe } = useSession();
  const router = useRouter();
  const errMsg = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const submitRef = useRef<HTMLButtonElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(t('login.error.empty'));
      return;
    }
    setBusy(true);
    try {
      const me = await api.login({ email: email.trim(), password });
      setMe(me);
      router.push(homePathFor(me.user.role));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) setError(t('login.error.invalid'));
      else if (err instanceof ApiError && err.status === 429) setError(t('login.error.rate'));
      else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const invalid = error ? true : undefined;
  return (
    <>
      <h1>{t('login.title')}</h1>
      <form onSubmit={onSubmit} noValidate className="card">
        <div className="field">
          <label htmlFor="email">{t('login.email')}</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid} aria-describedby={error ? 'login-error' : undefined} />
        </div>
        <div className="field">
          <label htmlFor="password">{t('login.password')}</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={invalid} aria-describedby={error ? 'login-error' : undefined} />
        </div>
        <div role="alert">
          <ErrorText id="login-error">{error}</ErrorText>
        </div>
        <button ref={submitRef} type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      {DEMO_MODE && (
        <section aria-labelledby="demo-h" className="card">
          <h2 id="demo-h">{t('login.demoTitle')}</h2>
          <p className="muted small">{t('login.demoHint')}</p>
          <ul className="list-plain">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                    setError('');
                    setStatus(t('login.filled', { name: a.name }));
                    submitRef.current?.focus();
                  }}
                >
                  {a.name} — {t(a.role)}
                </button>
              </li>
            ))}
          </ul>
          <Status>{status}</Status>
        </section>
      )}
      <p>
        <Link href="/emergency">
          <span aria-hidden="true">🆘 </span>
          {t('home.tile.emergency')} — {t('home.tile.emergency.desc')}
        </Link>
      </p>
    </>
  );
}
