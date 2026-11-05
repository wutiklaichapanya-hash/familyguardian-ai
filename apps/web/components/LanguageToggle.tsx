'use client';

import type { Locale } from '@fg/shared';
import { useI18n } from '@/lib/i18n';

/** Two real buttons with aria-pressed; the language name is always shown in its own script. */
export function LanguageToggle({ large = false }: { large?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const opts: Locale[] = ['th', 'en'];
  return (
    <div role="group" aria-label={t('lang.label')} className={large ? 'lang lang-large' : 'lang'}>
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          lang={o}
          aria-pressed={locale === o}
          className="lang-btn"
          onClick={() => setLocale(o)}
        >
          {t(o === 'th' ? 'lang.th' : 'lang.en')}
        </button>
      ))}
    </div>
  );
}
