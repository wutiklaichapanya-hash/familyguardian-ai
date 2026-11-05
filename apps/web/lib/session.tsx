'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { MeRes, Role } from '@fg/shared';
import { api, ApiError, clearClientCaches } from './api';
import { useApplyUserLocale } from './i18n';

type Status = 'loading' | 'signed_in' | 'signed_out' | 'error';

interface SessionValue {
  status: Status;
  me: MeRes | null;
  refresh: () => Promise<MeRes | null>;
  setMe: (me: MeRes | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** localStorage key written on confirmed sign-out so other tabs leave too. Holds only a timestamp. */
const SIGNOUT_KEY = 'fg-signed-out';
/** Query flag on "/" when the server could not confirm sign-out. */
export const SIGNOUT_FAILED_PARAM = 'signout';

export function homePathFor(role: Role): string {
  switch (role) {
    case 'senior':
      return '/home';
    case 'family':
    case 'caregiver':
      return '/family';
    case 'admin':
    case 'org_admin':
      return '/admin';
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMeState] = useState<MeRes | null>(null);

  const setMe = useCallback((m: MeRes | null) => {
    setMeState(m);
    setStatus(m ? 'signed_in' : 'signed_out');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setMe(m);
      return m;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setMe(null);
      } else {
        setMeState(null);
        setStatus('error');
      }
      return null;
    }
  }, [setMe]);

  const logout = useCallback(async () => {
    let confirmed = true;
    try {
      await api.logout();
    } catch (e) {
      // 401/403 means the server session is already gone; anything else is unconfirmed.
      confirmed = e instanceof ApiError && (e.status === 401 || e.status === 403);
    }
    setMe(null);
    await clearClientCaches();
    if (confirmed) {
      // Tell other open tabs to drop their screens too (shared-device privacy, SR-14).
      try {
        window.localStorage.setItem(SIGNOUT_KEY, String(Date.now()));
      } catch {
        /* storage unavailable */
      }
    }
    // Full reload so no personal data stays in React state or the router cache. If the server did not
    // confirm sign-out, say so on the next screen instead of implying it succeeded.
    window.location.assign(confirmed ? '/' : `/?${SIGNOUT_FAILED_PARAM}=1`);
  }, [setMe]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Shared-device privacy (SR-14): cross-tab sign-out, Back/forward-cache restores and revoked sessions.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (status === 'signed_in') wasSignedIn.current = true;
  }, [status]);
  useEffect(() => {
    const leave = () => {
      void clearClientCaches().finally(() => window.location.assign('/'));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIGNOUT_KEY && wasSignedIn.current) leave();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // A page restored from the back/forward cache may still show personal data: reload it fresh.
      if (e.persisted && wasSignedIn.current) window.location.reload();
    };
    const recheck = () => {
      if (!wasSignedIn.current || document.visibilityState !== 'visible') return;
      api.me().catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) leave();
      });
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  useApplyUserLocale(me?.user);

  useEffect(() => {
    // Senior UI uses a 20px base, family/caregiver/admin 18px (UX spec §2).
    document.documentElement.dataset.audience = me?.user.role === 'senior' || !me ? 'senior' : 'family';
  }, [me]);

  return (
    <SessionContext.Provider value={{ status, me, refresh, setMe, logout }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside <SessionProvider>');
  return v;
}
