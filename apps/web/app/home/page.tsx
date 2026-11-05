'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { MOOD_LABELS, MOODS } from '@fg/shared';
import { MorningArt } from '@/components/Art';
import { Icon, type IconName } from '@/components/icons';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { formatLongDate } from '@/lib/i18n/format';
import { useSession } from '@/lib/session';
import { MOOD_ICON } from '@/lib/visual';
import { RequireRole } from '@/components/ui';

// Home (UX §1: at most 6 main tiles). Check-in is the mood card on top: each feeling opens the
// check-in page with that feeling pre-selected (nothing is saved until the senior presses Save).
// Four action tiles follow. The medicine roadmap note sits outside navigation so nothing is a dead end.
const TILES: { href: string; icon: IconName; title: MessageKey; desc: MessageKey; fc: string }[] = [
  { href: '/contacts', icon: 'phone', title: 'home.tile.call', desc: 'home.tile.call.desc', fc: 'green' },
  { href: '/scam-check', icon: 'shieldSearch', title: 'home.tile.scam', desc: 'home.tile.scam.desc', fc: 'blue' },
  { href: '/guardian-pause', icon: 'pauseHand', title: 'home.tile.pause', desc: 'home.tile.pause.desc', fc: 'orange' },
  { href: '/help', icon: 'handRaised', title: 'home.tile.help', desc: 'home.tile.help.desc', fc: 'purple' },
];

function SeniorHome() {
  const { t, l, locale } = useI18n();
  const { me } = useSession();
  return (
    <>
      <section className="greet" aria-labelledby="greet-h">
        <div className="greet-text">
          <h1 id="greet-h">
            {/* Each phrase wraps as a unit so the line breaks after the greeting, not inside the name. */}
            {t('home.greeting', { name: me?.user.displayName ?? '' })
              .split(' ')
              .reduce<string[]>((acc, w, i) => (i < 2 ? [...acc, w] : [acc[0]!, `${acc[1]} ${w}`]), [])
              .map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && ' '}
                  <span className="nobreak-chunk">{part}</span>
                </Fragment>
              ))}
          </h1>
          <p className="greet-date">
            <Icon name="calendar" size="1.1em" />
            {formatLongDate(new Date().toISOString(), locale)}
          </p>
        </div>
        <MorningArt />
      </section>

      <nav aria-label={t('home.tilesLabel')}>
        <section className="mood-card" aria-labelledby="mood-h">
          <h2 id="mood-h">{t('home.tile.checkin.desc')}</h2>
          <p className="muted small mood-card-hint">{t('home.moodQuick')}</p>
          <ul className="mood-quick">
            {MOODS.map((m) => (
              <li key={m}>
                <Link href={`/checkin?mood=${m}`} className={`mood-quick-tile mf-${m}`}>
                  <span className="mood-face">
                    <Icon name={MOOD_ICON[m]} />
                  </span>
                  <span>{l(MOOD_LABELS[m])}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/checkin" className="mood-card-link">
            <Icon name="sun" size="1.2em" />
            {t('home.tile.checkin')}
            <Icon name="chevronRight" size="1.1em" />
          </Link>
        </section>

        <ul className="tiles">
          {TILES.map((tile) => (
            <li key={tile.href}>
              <Link href={tile.href} className={`tile fc-${tile.fc}`}>
                <span className="ibadge ibadge-lg">
                  <Icon name={tile.icon} />
                </span>
                <span className="tile-title">{t(tile.title)}</span>
                <span className="tile-desc">{t(tile.desc)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="more-h" className="more">
        <h2 id="more-h">{t('home.more')}</h2>
        <ul className="rows">
          <li>
            <Link className="row-link" href="/privacy">
              <span className="ibadge ibadge-sm fc-teal"><Icon name="share" /></span>
              <span className="row-text">{t('nav.privacy')}</span>
              <Icon name="chevronRight" className="row-chev" />
            </Link>
          </li>
          <li>
            <Link className="row-link" href="/notifications">
              <span className="ibadge ibadge-sm fc-blue"><Icon name="bell" /></span>
              <span className="row-text">{t('nav.notifications')}</span>
              <Icon name="chevronRight" className="row-chev" />
            </Link>
          </li>
          <li className="row-static">
            <span className="ibadge ibadge-sm fc-slate ibadge-muted"><Icon name="pill" /></span>
            <span className="row-text muted">{t('home.tile.meds')}</span>
            <span className="badge-soon">{t('home.tile.meds.soon')}</span>
          </li>
        </ul>
      </section>

      <p className="footer-tagline">
        <Icon name="heart" size="1.1em" />
        {t('app.footerTagline')}
      </p>

      {/* Docked above the tab bar, visible from first load; space is reserved below the content (globals.css). */}
      <div className="emergency-bar">
        <Link href="/emergency" className="btn emergency-btn">
          <Icon name="phone" size="1.25em" />
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
