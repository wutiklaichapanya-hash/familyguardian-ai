// Localised, route-specific document titles (WCAG 2.4.2). Pure so it can be unit-tested.
import type { MessageKey } from './i18n/th';

/** Every app route (app/**\/page.tsx) maps to a catalogue key. Dynamic segments use the folder name. */
export const ROUTE_TITLES: Record<string, MessageKey> = {
  '/': 'title.welcome',
  '/login': 'login.title',
  '/home': 'nav.home',
  '/checkin': 'home.tile.checkin',
  '/contacts': 'contacts.title',
  '/scam-check': 'scam.title',
  '/guardian-pause': 'pause.title',
  '/help': 'help.title',
  '/emergency': 'emergency.title',
  '/privacy': 'privacy.title',
  '/invite/accept': 'accept.title',
  '/family': 'family.title',
  '/alerts/[id]': 'alert.title',
  '/notifications': 'notif.title',
  '/admin': 'admin.title',
  '/billing': 'billing.title',
};

/** Resolve a concrete pathname (e.g. /alerts/abc) to its title key, or null for unknown routes. */
export function routeTitleKey(pathname: string | null | undefined): MessageKey | null {
  if (!pathname) return null;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (ROUTE_TITLES[clean]) return ROUTE_TITLES[clean];
  if (/^\/alerts\/[^/]+$/.test(clean)) return ROUTE_TITLES['/alerts/[id]'] ?? null;
  return null;
}

/** "<page> · FamilyGuardian", or just the app name for unknown routes. */
export function documentTitle(pathname: string | null | undefined, t: (k: MessageKey) => string): string {
  const key = routeTitleKey(pathname);
  const app = t('app.name');
  return key ? `${t(key)} · ${app}` : app;
}
