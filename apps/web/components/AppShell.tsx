'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { homePathFor, useSession } from '@/lib/session';
import { LanguageToggle } from './LanguageToggle';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { me, logout } = useSession();
  const role = me?.user.role;

  const links: { href: string; label: string }[] = [];
  if (role === 'senior') {
    links.push({ href: '/home', label: t('nav.home') }, { href: '/privacy', label: t('nav.privacy') });
  } else if (role === 'family' || role === 'caregiver') {
    links.push(
      { href: '/family', label: t('nav.dashboard') },
      { href: '/notifications', label: t('nav.notifications') },
      { href: '/invite/accept', label: t('nav.acceptInvite') },
    );
  } else if (role === 'admin' || role === 'org_admin') {
    links.push({ href: '/admin', label: t('nav.admin') });
  }

  return (
    <>
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <p className="demo-banner">
        <span aria-hidden="true">ⓘ </span>
        {t('demo.banner')}
      </p>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href={role ? homePathFor(role) : '/'} className="brand">
            <img src="/icon.svg" alt="" width={36} height={36} />
            <span>{t('app.name')}</span>
          </Link>
          <LanguageToggle />
        </div>
        {me && (
          <nav aria-label={t('nav.main')} className="site-nav">
            <ul>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void logout()}
                >
                  {t('nav.logout')}
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1} className="site-main">
        {children}
      </main>
    </>
  );
}
