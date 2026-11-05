'use client';

import type { Locale } from '@fg/shared';
import { useI18n } from '@/lib/i18n';

/**
 * Two real buttons with aria-pressed; the language name is always shown in its own script.
 * Compact (header) shows a short label inside a segmented pill; the full language name follows it
 * as hidden text, so the accessible name contains the visible label (WCAG 2.5.3 label-in-name).
 */
export function LanguageToggle({ large = false }: { large?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const opts: Locale[] = ['th', 'en'];
  return (
    <div role="group" aria-label={t('lang.label')} className={large ? 'lang lang-large' : 'lang lang-pill'}>
      {opts.map((o) => {
        const full = t(o === 'th' ? 'lang.th' : 'lang.en');
        const short = t(o === 'th' ? 'lang.th.short' : 'lang.en.short');
        return (
          <button
            key={o}
            type="button"
            lang={o}
            aria-pressed={locale === o}
            className="lang-btn"
            onClick={() => setLocale(o)}
          >
            {large ? (
              full
            ) : (
              <>
                <span className="lang-seg">{short}</span>
                {short !== full && <span className="visually-hidden"> {full}</span>}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
