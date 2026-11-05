'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@fg/shared';
import type { MessageKey } from './th';
import { translate, type Particle, type Vars } from './format';

export type { MessageKey } from './th';

const STORAGE_KEY = 'fg-locale';

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** True once the person has explicitly picked a language on this device. */
  explicit: boolean;
  particle: Particle;
  setParticle: (p: Particle) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  /** Pick the current locale from a bilingual label object such as DASHBOARD_LABELS[x]. */
  l: (label: Record<Locale, string>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStored(): Locale | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'th' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('th');
  const [explicit, setExplicit] = useState(false);
  const [particle, setParticle] = useState<Particle>('ka');

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setLocaleState(stored);
      setExplicit(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setExplicit(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable: preference lasts for this visit only */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      explicit,
      particle,
      setParticle,
      t: (key, vars) => translate(locale, key, vars, particle),
      l: (label) => label[locale],
    }),
    [locale, setLocale, explicit, particle],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}

/** Lets the session apply the user's locale only when the person has not picked one on this device. */
export function useApplyUserLocale(user: { locale: Locale; politeParticle: Particle } | null | undefined) {
  const { setParticle, explicit, locale, setLocale } = useI18n();
  useEffect(() => {
    if (!user) return;
    setParticle(user.politeParticle);
    if (!explicit && user.locale !== locale) setLocale(user.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.politeParticle, user?.locale]);
}
