'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
    try {
      await api.logout();
    } catch {
      /* still clear locally */
    } finally {
      setMe(null);
      await clearClientCaches();
      // Full reload so no personal data stays in React state or the router cache.
      window.location.assign('/');
    }
  }, [setMe]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
