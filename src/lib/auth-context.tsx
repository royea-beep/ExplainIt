"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

const AUTH_TOKEN_KEY = "explainit_token";
const REFRESH_ENDPOINT = "/api/auth/refresh";

export interface User {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  /** Fetch with auto-attached Bearer token and 401 retry via refresh. */
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodePayload(token: string): { userId: string; email: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.userId, email: payload.email, exp: payload.exp };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  // --- Helpers ---

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch { /* ignore */ }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (currentToken: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const payload = decodePayload(currentToken);
      if (!payload?.exp) return;

      // Refresh 60s before expiry, minimum 5s from now
      const refreshIn = Math.max((payload.exp * 1000) - Date.now() - 60_000, 5_000);

      refreshTimerRef.current = setTimeout(async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        try {
          const res = await fetch(REFRESH_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: currentToken }),
          });
          if (!res.ok) { clearAuth(); return; }
          const data = await res.json();
          setToken(data.token);
          setUser(data.user);
          try { localStorage.setItem(AUTH_TOKEN_KEY, data.token); } catch { /* ignore */ }
          scheduleRefresh(data.token);
        } catch {
          clearAuth();
        } finally {
          isRefreshingRef.current = false;
        }
      }, refreshIn);
    },
    [clearAuth],
  );

  const saveAuth = useCallback(
    (u: User, t: string) => {
      setUser(u);
      setToken(t);
      try { localStorage.setItem(AUTH_TOKEN_KEY, t); } catch { /* ignore */ }
      scheduleRefresh(t);
    },
    [scheduleRefresh],
  );

  // --- Restore session on mount ---

  useEffect(() => {
    if (typeof window === "undefined") { setLoading(false); return; }
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    if (stored) {
      const payload = decodePayload(stored);
      if (payload) {
        setToken(stored);
        setUser({ id: payload.userId, email: payload.email });
        scheduleRefresh(stored);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
    setLoading(false);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // --- Auth actions ---

  const signIn = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Login failed");
    }
    const data = await res.json();
    saveAuth(data.user, data.token);
  };

  const signUp = async (email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Registration failed");
    }
    const data = await res.json();
    saveAuth(data.user, data.token);
  };

  // --- authFetch: auto Bearer + 401 retry via refresh ---

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const makeRequest = (t: string | null) =>
        fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
        });

      const res = await makeRequest(token);

      if (res.status === 401 && token && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        try {
          const rr = await fetch(REFRESH_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (rr.ok) {
            const data = await rr.json();
            setToken(data.token);
            setUser(data.user);
            try { localStorage.setItem(AUTH_TOKEN_KEY, data.token); } catch { /* ignore */ }
            scheduleRefresh(data.token);
            return makeRequest(data.token);
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
    [token, clearAuth, scheduleRefresh],
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut: clearAuth, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
