"use client";

import React from "react";
import { Globe } from "lucide-react";
import { DEFAULT_LOCALE, LOCALE_LABELS, PANEL_LOCALES } from "./dictionaries";
import { useLocale } from "./LocaleProvider";
import { Select } from "@/lib/ui/Select";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <Globe size={13} className="text-[#5b6f85]" />
      <Select
        ariaLabel="Til / Язык / Language"
        value={PANEL_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE}
        onChange={(v) => setLocale(v as any)}
        options={PANEL_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
        className="flex items-center gap-1 bg-transparent text-[12px] font-medium text-muted cursor-pointer"
      />
    </div>
  );
}
