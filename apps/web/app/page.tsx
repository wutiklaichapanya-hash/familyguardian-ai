'use client';

import { Icon } from '@/components/icons';
import { HeroArt } from '@/components/Art';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { homePathFor, SIGNOUT_FAILED_PARAM, useSession } from '@/lib/session';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function WelcomePage() {
  const { t } = useI18n();
  const { me, logout } = useSession();
  const [signoutFailed, setSignoutFailed] = useState(false);

  useEffect(() => {
    setSignoutFailed(new URLSearchParams(window.location.search).has(SIGNOUT_FAILED_PARAM));
  }, []);

  return (
    <>
      {signoutFailed && (
        // Never imply the server signed this device out when it did not confirm it (SR-14).
        <div className="notice notice-warm" role="alert">
          <p>
            <strong>{t('signout.failed')}</strong>
          </p>
          {me && (
            <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
              {t('signout.retry')}
            </button>
          )}
        </div>
      )}
      <div className="hero">
        <HeroArt />
        <h1>{t('welcome.title')}</h1>
        <p className="muted">{t('app.tagline')}</p>
      </div>
      <section aria-labelledby="lang-h" className="card">
        <h2 id="lang-h">{t('welcome.chooseLang')}</h2>
        <LanguageToggle large />
      </section>
      <ul className="promises">
        <li>
          <span className="ibadge fc-amber"><Icon name="sun" /></span>
          <span>{t('welcome.promise1')}</span>
        </li>
        <li>
          <span className="ibadge fc-blue"><Icon name="shieldSearch" /></span>
          <span>{t('welcome.promise2')}</span>
        </li>
        <li>
          <span className="ibadge fc-teal"><Icon name="lock" /></span>
          <span>{t('welcome.promise3')}</span>
        </li>
      </ul>
      <div className="stack">
        {me ? (
          <Link className="btn btn-primary btn-block" href={homePathFor(me.user.role)}>
            {t('welcome.continue')}
          </Link>
        ) : (
          <Link className="btn btn-primary btn-block" href="/login">
            {t('welcome.start')}
          </Link>
        )}
        <Link className="btn btn-danger btn-block" href="/emergency">
          <Icon name="siren" size="1.2em" />
          {t('home.tile.emergency')} — {t('home.tile.emergency.desc')}
        </Link>
      </div>
      <p className="muted small">{t('welcome.honest')}</p>
    </>
  );
}
