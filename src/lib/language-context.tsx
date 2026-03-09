/**
 * Re-export shared i18n from @royea/shared-utils with browser language detection.
 * Consumers import from '@/lib/language-context' — no import changes needed.
 */
"use client";

export {
  useLanguage,
  isHebrew,
  detectDir,
  type Language,
  type LanguageContextValue,
  type LanguageProviderProps,
} from '@royea/shared-utils/i18n';

import { LanguageProvider as BaseLanguageProvider, type LanguageProviderProps, type Language } from '@royea/shared-utils/i18n';
import { type ReactNode } from 'react';

/**
 * Detect default language from browser.
 * Returns "he" if browser language starts with "he", otherwise "en".
 */
function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  return lang.toLowerCase().startsWith('he') ? 'he' : 'en';
}

interface Props extends Omit<LanguageProviderProps, 'defaultLang'> {
  children: ReactNode;
  defaultLang?: Language;
}

/**
 * LanguageProvider with automatic browser language detection.
 * Hebrew browsers → Hebrew default. All others → English default.
 * Overridden by localStorage if user has toggled before.
 */
export function LanguageProvider({ children, defaultLang, ...rest }: Props) {
  const detected = defaultLang ?? detectBrowserLanguage();
  return (
    <BaseLanguageProvider defaultLang={detected} {...rest}>
      {children}
    </BaseLanguageProvider>
  );
}
