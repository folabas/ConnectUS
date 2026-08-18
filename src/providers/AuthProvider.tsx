'use client';

/**
 * Session state for the whole app.
 *
 * Previously each page read `localStorage` directly and no page verified the
 * token, so `/watch` rendered fine while signed out and only failed once an API
 * call came back 401. This provider resolves the session once on boot and
 * exposes a `status` that route guards can wait on.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { authApi, session, setUnauthorizedHandler } from '@/lib/api';
import type { User } from '@/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /**
   * True from the moment sign-out starts until the redirect lands. Route guards
   * check it so they do not race the sign-out navigation: clearing the session
   * makes the guard see an anonymous user and bounce to /auth?next=<page>, which
   * beat signOut's own push to / and left the user staring at a sign-in form.
   */
  signingOut: boolean;
  signIn(credentials: { email: string; password: string }): Promise<User>;
  signUp(data: { email: string; password: string; fullName?: string }): Promise<User>;
  signOut(): Promise<void>;
  updateUser(patch: Partial<User>): void;
  /** Re-fetch the profile from the server, e.g. after stats change. */
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Guards against a 401 storm (several parallel requests) triggering N redirects.
  const expiredRedirect = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  const clearSession = useCallback(() => {
    session.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (expiredRedirect.current) return;
      expiredRedirect.current = true;
      clearSession();
      router.replace('/auth?expired=1');
      // Allow a later genuine expiry to redirect again.
      setTimeout(() => {
        expiredRedirect.current = false;
      }, 1000);
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, router]);

  // Resolve the session once on boot. The cached user renders immediately so the
  // app does not flash a spinner, then the server confirms it.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const token = session.getToken();
      if (!token) {
        setStatus('anonymous');
        return;
      }

      const cached = session.getUser();
      if (cached) {
        setUser(cached);
        setStatus('authenticated');
      }

      try {
        const fresh = await authApi.me();
        if (cancelled) return;
        // `/me` returns the profile without the token, so preserve what we have.
        const merged = { ...cached, ...fresh } as User;
        setUser(merged);
        session.setUser(merged);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        // The 401 handler above has already cleared storage and redirected.
        clearSession();
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const persist = useCallback((result: User & { token: string }) => {
    const { token, ...profile } = result;
    const nextUser = profile as User;
    session.set(token, nextUser);
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const signIn: AuthContextValue['signIn'] = useCallback(
    async (credentials) => persist(await authApi.login(credentials)),
    [persist],
  );

  const signUp: AuthContextValue['signUp'] = useCallback(
    async (data) => persist(await authApi.register(data)),
    [persist],
  );

  const signOut: AuthContextValue['signOut'] = useCallback(async () => {
    setSigningOut(true);
    try {
      await authApi.logout();
    } catch {
      // A failed logout call must not strand the user in a signed-in shell.
    }
    clearSession();
    router.replace('/');
  }, [clearSession, router]);

  const updateUser: AuthContextValue['updateUser'] = useCallback((patch) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      session.setUser(next);
      return next;
    });
  }, []);

  const refresh: AuthContextValue['refresh'] = useCallback(async () => {
    if (!session.getToken()) return;
    try {
      const fresh = await authApi.me();
      setUser((current) => {
        const next = { ...current, ...fresh } as User;
        session.setUser(next);
        return next;
      });
    } catch {
      // Non-fatal: keep showing the cached profile.
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      signingOut,
      signIn,
      signUp,
      signOut,
      updateUser,
      refresh,
    }),
    [user, status, signingOut, signIn, signUp, signOut, updateUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
