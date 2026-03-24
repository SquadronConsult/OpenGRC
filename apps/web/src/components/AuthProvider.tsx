'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, clearAuthToken, getToken } from '@/lib/api';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/bootstrap')) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<AuthUser>('/auth/me', { skipAuthRedirect: true });
      setUser(me);
    } catch {
      setUser(null);
      clearAuthToken();
    }
  }, []);

  useEffect(() => {
    if (isPublicPath(pathname)) {
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await api<AuthUser>('/auth/me', { skipAuthRedirect: true });
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) {
          setUser(null);
          clearAuthToken();
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const value = useMemo(
    () => ({
      user,
      loading: isPublicPath(pathname) ? false : loading,
      refresh,
    }),
    [user, loading, pathname, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
