"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional message to show above the form */
  reason?: string;
  /** Called after successful sign-in/sign-up (before onClose) */
  onSuccess?: () => void;
}

export function AuthModal({ open, onClose, reason, onSuccess }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const { isHe } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setError(null);
      setEmail("");
      setPassword("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "signup" ? "Create account" : "Sign in"}
    >
      <div className="w-full max-w-sm bg-[#12121f] border border-white/10 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">
            {mode === "signup"
              ? isHe ? "יצירת חשבון" : "Create Account"
              : isHe ? "התחברות" : "Sign In"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Reason message */}
        {reason && (
          <p className="text-sm text-white/50 mb-4 leading-relaxed">{reason}</p>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-sm text-white/60 mb-1.5">
              {isHe ? "אימייל" : "Email"}
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              dir="ltr"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm text-white/60 mb-1.5">
              {isHe ? "סיסמה" : "Password"}
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              dir="ltr"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/25 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              placeholder={isHe ? "לפחות 8 תווים" : "At least 8 characters"}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isHe ? "טוען..." : "Loading..."}
              </span>
            ) : mode === "signup" ? (
              isHe ? "צור חשבון" : "Create Account"
            ) : (
              isHe ? "התחבר" : "Sign In"
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-sm text-white/40 mt-4">
          {mode === "signup" ? (
            <>
              {isHe ? "כבר יש חשבון?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                {isHe ? "התחבר" : "Sign in"}
              </button>
            </>
          ) : (
            <>
              {isHe ? "אין חשבון?" : "No account?"}{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                {isHe ? "צור חשבון" : "Create one"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
