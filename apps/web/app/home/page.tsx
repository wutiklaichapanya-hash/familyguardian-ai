'use client';

import Link from 'next/link';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { RequireRole } from '@/components/ui';

// Five working tiles (UX §1: at most 6). Guardian Pause replaces the unavailable medicine tile;
// the medicine roadmap note sits outside navigation so nothing in the grid is a dead end.
const TILES: { href: string; icon: string; title: MessageKey; desc: MessageKey; className?: string }[] = [
  { href: '/checkin', icon: '☀️', title: 'home.tile.checkin', desc: 'home.tile.checkin.desc', className: 'tile-checkin' },
  { href: '/contacts', icon: '📞', title: 'home.tile.call', desc: 'home.tile.call.desc' },
  { href: '/scam-check', icon: '🔍', title: 'home.tile.scam', desc: 'home.tile.scam.desc' },
  { href: '/guardian-pause', icon: '✋', title: 'home.tile.pause', desc: 'home.tile.pause.desc' },
  { href: '/help', icon: '🙋', title: 'home.tile.help', desc: 'home.tile.help.desc' },
];

function SeniorHome() {
  const { t } = useI18n();
  const { me } = useSession();
  return (
    <>
      <h1>{t('home.greeting', { name: me?.user.displayName ?? '' })}</h1>
      <nav aria-label={t('home.tilesLabel')}>
        <ul className="tiles">
          {TILES.map((tile) => (
            <li key={tile.href}>
              <Link href={tile.href} className={`tile ${tile.className ?? ''}`}>
                <span className="tile-icon" aria-hidden="true">{tile.icon}</span>
                <span className="tile-title">{t(tile.title)}</span>
                <span className="tile-desc">{t(tile.desc)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-labelledby="more-h">
        <h2 id="more-h" className="small muted">{t('home.more')}</h2>
        <div className="btn-row">
          <Link className="btn btn-secondary" href="/privacy">{t('nav.privacy')}</Link>
          <Link className="btn btn-secondary" href="/notifications">{t('nav.notifications')}</Link>
        </div>
        <p className="muted small">
          {t('home.tile.meds')}: {t('home.tile.meds.soon')}
        </p>
      </section>
      {/* Fixed dock, visible from first load; space is reserved below main content (see globals.css). */}
      <div className="emergency-bar">
        <Link href="/emergency" className="btn emergency-btn">
          <span aria-hidden="true">🆘 </span>
          {t('home.tile.emergency')} · {t('home.tile.emergency.desc')}
        </Link>
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <RequireRole roles={['senior']}>
      <SeniorHome />
    </RequireRole>
  );
}
