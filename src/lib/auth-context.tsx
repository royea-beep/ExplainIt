"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const AUTH_TOKEN_KEY = "explainit_token";

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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodePayload(token: string): { userId: string; email: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { userId?: string; email?: string };
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    const payload = decodePayload(stored);
    if (payload) {
      setToken(stored);
      setUser({ id: payload.userId, email: payload.email });
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

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
    const data = (await res.json()) as { user: { id: string; email: string }; token: string };
    setUser(data.user);
    setToken(data.token);
    if (typeof window !== "undefined") localStorage.setItem(AUTH_TOKEN_KEY, data.token);
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
    const data = (await res.json()) as { user: { id: string; email: string }; token: string };
    setUser(data.user);
    setToken(data.token);
    if (typeof window !== "undefined") localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  };

  const signOut = async () => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
