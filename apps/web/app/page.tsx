'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { homePathFor, useSession } from '@/lib/session';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function WelcomePage() {
  const { t } = useI18n();
  const { me } = useSession();
  return (
    <>
      <h1>{t('welcome.title')}</h1>
      <p className="muted">{t('app.tagline')}</p>
      <section aria-labelledby="lang-h" className="card">
        <h2 id="lang-h">{t('welcome.chooseLang')}</h2>
        <LanguageToggle large />
      </section>
      <ul className="stack" style={{ paddingInlineStart: '1.2em' }}>
        <li>{t('welcome.promise1')}</li>
        <li>{t('welcome.promise2')}</li>
        <li>{t('welcome.promise3')}</li>
      </ul>
      <p className="notice notice-warm">{t('demo.banner')}</p>
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
          <span aria-hidden="true">🆘 </span>
          {t('home.tile.emergency')} — {t('home.tile.emergency.desc')}
        </Link>
      </div>
      <p className="muted small">{t('welcome.honest')}</p>
    </>
  );
}
