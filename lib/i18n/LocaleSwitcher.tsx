"use client";

import React from "react";
import { Globe } from "lucide-react";
import { DEFAULT_LOCALE, LOCALE_LABELS, PANEL_LOCALES } from "./dictionaries";
import { useLocale } from "./LocaleProvider";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <Globe size={13} className="text-[#5b6f85]" />
      <select
        aria-label="Til / Язык / Language"
        value={PANEL_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE}
        onChange={(e) => setLocale(e.target.value as any)}
        className="bg-transparent text-[12px] font-medium text-muted outline-none cursor-pointer"
      >
        {PANEL_LOCALES.map((l) => (
          <option key={l} value={l} className="bg-panel text-white">
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
