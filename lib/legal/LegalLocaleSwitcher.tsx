"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { PANEL_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, LOCALE_COOKIE, Locale } from "@/lib/i18n/dictionaries";
import { Select } from "@/lib/ui/Select";

// Faqat PANEL_LOCALES (uz/ru) taklif qilinadi: `en` lug'ati to'liq emas,
// uni tanlagan foydalanuvchi saytning ko'p qismida o'zbekcha fallback ko'rardi.
// Legal/content pages are Server Components (for SEO), so switching
// language here writes the cookie directly and forces a server refetch
// via router.refresh() — the client-side LocaleProvider context can't
// reach into an already-rendered Server Component, only a real refetch can.
export function LegalLocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();

  const setLocale = (locale: string) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-subtle px-2.5 py-1.5">
      <Globe size={13} className="text-muted" />
      <Select
        value={PANEL_LOCALES.includes(current) ? current : DEFAULT_LOCALE}
        onChange={setLocale}
        options={PANEL_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
        className="flex items-center gap-1 bg-transparent text-[12px] font-medium text-muted cursor-pointer"
      />
    </div>
  );
}
