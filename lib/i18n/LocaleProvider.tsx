"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale, dictionaries } from "./dictionaries";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "uz" || value === "ru" || value === "en" ? value : null;
}

function resolveByPath(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const cookieLocale = readCookieLocale();
    if (cookieLocale) setLocaleState(cookieLocale);
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const t = useMemo(() => {
    return (path: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale];
      let str = resolveByPath(dict, path) ?? resolveByPath(dictionaries[DEFAULT_LOCALE], path) ?? path;
      if (vars) {
        for (const [key, value] of Object.entries(vars)) {
          str = str.replace(`{${key}}`, String(value));
        }
      }
      return str;
    };
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
