'use client';

import Link from 'next/link';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { RequireRole } from '@/components/ui';

const TILES: { href: string; icon: string; title: MessageKey; desc: MessageKey; className?: string }[] = [
  { href: '/checkin', icon: '☀️', title: 'home.tile.checkin', desc: 'home.tile.checkin.desc', className: 'tile-checkin' },
  { href: '/contacts', icon: '📞', title: 'home.tile.call', desc: 'home.tile.call.desc' },
  { href: '/scam-check', icon: '🔍', title: 'home.tile.scam', desc: 'home.tile.scam.desc' },
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
          <li>
            {/* P1 placeholder — honest, not interactive. */}
            <div className="tile tile-disabled">
              <span className="tile-icon" aria-hidden="true">💊</span>
              <span className="tile-title">{t('home.tile.meds')}</span>
              <span className="chip">{t('home.tile.meds.soon')}</span>
              <span className="tile-desc">{t('home.tile.meds.desc')}</span>
            </div>
          </li>
        </ul>
      </nav>
      <section aria-labelledby="more-h">
        <h2 id="more-h" className="small muted">{t('home.more')}</h2>
        <ul className="list-plain">
          <li><Link href="/guardian-pause">{t('nav.pause')}</Link></li>
          <li><Link href="/privacy">{t('nav.privacy')}</Link></li>
        </ul>
      </section>
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
