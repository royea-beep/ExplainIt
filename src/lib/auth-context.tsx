"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface User {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Placeholder auth provider. Replace signIn/signOut with real session (e.g. NextAuth, Supabase)
 * when adding user accounts. For now, user is always null.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading] = useState(false);

  const signIn = async (_email: string, _password: string) => {
    // TODO: call POST /api/auth/login and set session
    setUser(null);
  };

  const signOut = async () => {
    // TODO: clear session
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
