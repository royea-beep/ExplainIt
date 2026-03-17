/**
 * Language Context — Hebrew/English RTL-aware i18n for React apps.
 * Extracted from ExplainIt + ZProjectManager.
 *
 * Usage:
 *   import { LanguageProvider, useLanguage } from '@royea/shared-utils/i18n';
 *
 *   // Wrap your app:
 *   <LanguageProvider defaultLang="he" storageKey="my-app-lang">
 *     <App />
 *   </LanguageProvider>
 *
 *   // In components:
 *   const { language, dir, isHe, toggleLanguage } = useLanguage();
 */

"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Language = "he" | "en";

export interface LanguageContextValue {
  language: Language;
  dir: "rtl" | "ltr";
  isHe: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export interface LanguageProviderProps {
  children: ReactNode;
  /** Default language (default: 'he') */
  defaultLang?: Language;
  /** localStorage key for persistence (default: 'app-lang') */
  storageKey?: string;
  /** Update <html> dir and lang attributes (default: true) */
  syncHtml?: boolean;
}

export function LanguageProvider({
  children,
  defaultLang = "he",
  storageKey = "app-lang",
  syncHtml = true,
}: LanguageProviderProps) {
  const [language, setLang] = useState<Language>(defaultLang);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(storageKey);
    if (saved === "en" || saved === "he") setLang(saved);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, language);
    if (syncHtml) {
      document.documentElement.lang = language;
      document.documentElement.dir = language === "he" ? "rtl" : "ltr";
    }
  }, [language, storageKey, syncHtml]);

  const setLanguage = useCallback((lang: Language) => setLang(lang), []);
  const toggleLanguage = useCallback(() => setLang((l) => (l === "he" ? "en" : "he")), []);

  const dir = language === "he" ? "rtl" : "ltr";
  const isHe = language === "he";

  return (
    <LanguageContext.Provider value={{ language, dir, isHe, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Detect if text contains Hebrew characters */
export function isHebrew(text: string): boolean {
  return /[\u05D0-\u05EA]/.test(text);
}

/** Get text direction for a string */
export function detectDir(text: string): "rtl" | "ltr" {
  return isHebrew(text) ? "rtl" : "ltr";
}
