'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

const messages = {
  en,
  zh,
} as const;

type Locale = keyof typeof messages;
type MessagePath = string;

// Helper function to get nested object value by path
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

// Get locale from localStorage or default to 'en'
function getCurrentLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem('locale') as Locale) || 'en';
}

// Set locale in localStorage
function setCurrentLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
  }
}

interface I18nContextType {
  locale: Locale;
  changeLocale: (locale: Locale) => void;
  t: (key: MessagePath) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    setLocale(getCurrentLocale());
  }, []);

  const t = (key: MessagePath): string => {
    const value = getNestedValue(messages[locale], key) || getNestedValue(messages.en, key);
    return typeof value === 'string' ? value : key;
  };

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    setCurrentLocale(newLocale);
    // Trigger a storage event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'locale',
        newValue: newLocale,
      }));
    }
  };

  return (
    <I18nContext.Provider value={{ locale, changeLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

export const locales = ['en', 'zh'] as const;
export const defaultLocale = 'en' as const; 