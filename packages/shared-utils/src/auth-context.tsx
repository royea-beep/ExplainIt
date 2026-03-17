/**
 * React Auth context — JWT in memory + localStorage, auto-refresh, authFetch with 401 retry.
 * Use with @royea/shared-utils/auth (login/register/refresh API routes).
 *
 * Usage:
 *   import { AuthProvider, useAuth } from '@royea/shared-utils/auth-context';
 *   <AuthProvider storageKey="myapp_auth" refreshEndpoint="/api/auth/refresh">{children}</AuthProvider>
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  businessName?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, businessName?: string) => Promise<void>;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface AuthContextConfig {
  /** localStorage key for persisting auth (e.g. 'postpilot_auth', '12clicks_auth') */
  storageKey: string;
  /** Refresh endpoint (e.g. '/api/auth/refresh') */
  refreshEndpoint: string;
}

const AuthContext = createContext<AuthState | null>(null);

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({
  children,
  storageKey,
  refreshEndpoint,
}: { children: ReactNode } & AuthContextConfig) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, [storageKey]);

  const scheduleRefresh = useCallback(
    (accessToken: string, rt: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const expiry = getTokenExpiry(accessToken);
      if (!expiry) return;
      const refreshIn = Math.max(expiry - Date.now() - 60_000, 5_000);

      refreshTimerRef.current = setTimeout(async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        try {
          const res = await fetch(refreshEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) {
            clearAuth();
            return;
          }
          const data = await res.json();
          setToken(data.accessToken);
          setRefreshToken(data.refreshToken);
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              localStorage.setItem(
                storageKey,
                JSON.stringify({
                  user: parsed.user,
                  token: data.accessToken,
                  refreshToken: data.refreshToken,
                }),
              );
            }
          } catch {
            /* ignore */
          }
          scheduleRefresh(data.accessToken, data.refreshToken);
        } catch {
          clearAuth();
        } finally {
          isRefreshingRef.current = false;
        }
      }, refreshIn);
    },
    [clearAuth, refreshEndpoint, storageKey],
  );

  const saveAuth = useCallback(
    (u: AuthUser, at: string, rt: string) => {
      setUser(u);
      setToken(at);
      setRefreshToken(rt);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ user: u, token: at, refreshToken: rt }));
      } catch {
        /* ignore */
      }
      scheduleRefresh(at, rt);
    },
    [scheduleRefresh, storageKey],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { user: u, token: t, refreshToken: rt } = JSON.parse(saved);
        setUser(u);
        setToken(t);
        setRefreshToken(rt);
        if (t && rt) scheduleRefresh(t, rt);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [storageKey, scheduleRefresh]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || 'Login failed');
    }
    const d = await res.json();
    saveAuth(d.user, d.accessToken, d.refreshToken);
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    businessName?: string,
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, businessName }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || 'Registration failed');
    }
    const d = await res.json();
    saveAuth(d.user, d.accessToken, d.refreshToken);
  };

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401 && refreshToken && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        try {
          const rr = await fetch(refreshEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (rr.ok) {
            const d = await rr.json();
            setToken(d.accessToken);
            setRefreshToken(d.refreshToken);
            try {
              const saved = localStorage.getItem(storageKey);
              if (saved) {
                const p = JSON.parse(saved);
                localStorage.setItem(
                  storageKey,
                  JSON.stringify({
                    user: p.user,
                    token: d.accessToken,
                    refreshToken: d.refreshToken,
                  }),
                );
              }
            } catch {
              /* ignore */
            }
            scheduleRefresh(d.accessToken, d.refreshToken);
            return fetch(url, {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${d.accessToken}`,
                'Content-Type': 'application/json',
              },
            });
          }
          clearAuth();
        } catch {
          clearAuth();
        } finally {
          isRefreshingRef.current = false;
        }
      }
      return res;
    },
    [token, refreshToken, clearAuth, scheduleRefresh, refreshEndpoint, storageKey],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout: clearAuth, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
