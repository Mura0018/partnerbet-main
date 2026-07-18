"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, LOCALE_COOKIE, Locale } from "@/lib/i18n/dictionaries";

// Legal/content pages are Server Components (for SEO), so switching
// language here writes the cookie directly and forces a server refetch
// via router.refresh() — the client-side LocaleProvider context can't
// reach into an already-rendered Server Component, only a real refetch can.
export function LegalLocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();

  const setLocale = (locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5">
      <Globe size={13} className="text-muted" />
      <select
        value={current}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent text-[12px] font-medium text-muted outline-none cursor-pointer"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="bg-bg-panel text-white">{LOCALE_LABELS[l]}</option>
        ))}
      </select>
    </div>
  );
}
