'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { documentTitle } from '@/lib/routeTitles';
import { homePathFor, useSession } from '@/lib/session';
import { BrandMark } from './Art';
import { Icon, type IconName } from './icons';
import { LanguageToggle } from './LanguageToggle';

type Tab = { href: string; label: MessageKey; icon: IconName; emergency?: boolean; match?: string[] };

const EMERGENCY_TAB: Tab = { href: '/emergency', label: 'home.tile.emergency', icon: 'siren', emergency: true };

function tabsFor(role: string | undefined): Tab[] {
  if (role === 'senior')
    return [
      { href: '/home', label: 'nav.home', icon: 'home' },
      { href: '/notifications', label: 'nav.tab.notifications', icon: 'bell' },
      { href: '/privacy', label: 'nav.tab.sharing', icon: 'share' },
      EMERGENCY_TAB,
    ];
  if (role === 'family' || role === 'caregiver')
    return [
      { href: '/family', label: 'nav.tab.family', icon: 'users', match: ['/alerts'] },
      { href: '/notifications', label: 'nav.tab.notifications', icon: 'bell' },
      { href: '/invite/accept', label: 'nav.tab.invite', icon: 'mailPlus' },
      EMERGENCY_TAB,
    ];
  if (role === 'admin' || role === 'org_admin')
    return [{ href: '/admin', label: 'nav.admin', icon: 'grid', match: ['/billing'] }, EMERGENCY_TAB];
  return [];
}

function AccountMenu() {
  const { t } = useI18n();
  const { me, logout } = useSession();
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  // Close on navigation, outside click and Escape (focus returns to the summary).
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const d = ref.current;
      if (e.key === 'Escape' && d?.open) {
        d.open = false;
        d.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!me) return null;
  const name = me.user.displayName;
  const initial = Array.from(name.trim())[0] ?? '?';
  return (
    <details ref={ref} className="account">
      <summary className="account-btn">
        <span className="avatar avatar-sm" aria-hidden="true">{initial}</span>
        <span className="visually-hidden">{t('nav.account')}</span>
      </summary>
      <div className="account-menu">
        <p className="account-name">
          <span className="avatar" aria-hidden="true">{initial}</span>
          <span>{t('nav.signedInAs', { name })}</span>
        </p>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => void logout()}>
          <Icon name="logout" size="1.1em" />
          {t('nav.logout')}
        </button>
      </div>
    </details>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { me } = useSession();
  const pathname = usePathname() ?? '/';
  const role = me?.user.role;
  const tabs = tabsFor(role);
  const isActive = (tab: Tab) =>
    pathname === tab.href || pathname.startsWith(`${tab.href}/`) || (tab.match ?? []).some((m) => pathname.startsWith(m));

  return (
    <div className={tabs.length ? 'app has-tabbar' : 'app'}>
      {/* Route-specific, localised title (WCAG 2.4.2). React hoists <title> into <head>; the root
          layout deliberately sets no metadata title so this is the only one. */}
      <title>{documentTitle(pathname, t)}</title>
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <p className="demo-banner">
        <Icon name="info" size="1.05em" />
        {t('demo.banner')}
      </p>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href={role ? homePathFor(role) : '/'} className="brand">
            <BrandMark />
            <span className="brand-text">
              <span className="brand-name">{t('app.name')}</span>
              <span className="brand-tag" lang="en">
                <span className="brand-ai">{t('app.brandSuffix')}</span> <span className="brand-tag-text">{t('app.brandTagline')}</span>
              </span>
            </span>
          </Link>
          <div className="topbar-actions">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="site-main">
        {children}
      </main>
      {tabs.length > 0 && (
        <nav aria-label={t('nav.main')} className="tabbar">
          <ul>
            {tabs.map((tab) => {
              const active = isActive(tab);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={`tab${tab.emergency ? ' tab-emergency' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="tab-icon">
                      <Icon name={tab.icon} size={26} />
                    </span>
                    <span className="tab-label">{t(tab.label)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
