import type { Locale } from '@fg/shared';
import { en } from './en';
import { th, type MessageKey } from './th';

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { th, en };
export type Particle = 'ka' | 'krap';
export type Vars = Record<string, string | number>;

const PARTICLE_TH: Record<Particle, string> = { ka: 'ค่ะ', krap: 'ครับ' };

/** Resolve a message, apply the polite particle and interpolate {vars}. Pure (unit-tested). */
export function translate(locale: Locale, key: MessageKey, vars: Vars = {}, particle: Particle = 'ka'): string {
  const raw = MESSAGES[locale][key] ?? MESSAGES.th[key] ?? key;
  const withParticle = raw.replace(/\{p\}/g, locale === 'th' ? PARTICLE_TH[particle] : '');
  return withParticle.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
  );
}

const intlLocale = (l: Locale) => (l === 'th' ? 'th-TH' : 'en-GB');

export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function formatDate(iso: string | Date | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

export function formatLongDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'long' }).format(d);
}

export function formatTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), { timeStyle: 'short' }).format(d);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}
