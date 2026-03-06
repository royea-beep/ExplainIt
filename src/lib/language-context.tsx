"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type Language = "he" | "en";

interface LanguageContextValue {
  language: Language;
  dir: "rtl" | "ltr";
  isHe: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>("he");

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("explainit-lang");
    if (saved === "en" || saved === "he") {
      setLang(saved);
    }
  }, []);

  // Sync to <html> attributes and localStorage
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
    localStorage.setItem("explainit-lang", language);
  }, [language]);

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
