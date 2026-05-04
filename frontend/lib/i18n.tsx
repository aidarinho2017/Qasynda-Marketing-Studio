'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { en } from '@/messages/en';
import { ru } from '@/messages/ru';

export type Locale = 'en' | 'ru';
export type Messages = typeof en;

const messages: Record<Locale, Messages> = { en, ru };
const STORAGE_KEY = 'qasynda-locale';

interface I18nContextValue {
  locale: Locale;
  t: Messages;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'ru';
    return (localStorage.getItem(STORAGE_KEY) as Locale) ?? 'ru';
  });

  const setLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  };

  return (
    <I18nContext.Provider value={{ locale, t: messages[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside LanguageProvider');
  return ctx;
}

export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
