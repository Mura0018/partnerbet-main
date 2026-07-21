"use client";

import React from "react";
import { Check } from "lucide-react";
import { CHAT_THEMES, ChatThemeKey } from "@/lib/ui/chatThemes";

export function ThemePicker({ value, onChange }: { value: string; onChange: (theme: ChatThemeKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {(Object.keys(CHAT_THEMES) as ChatThemeKey[]).map((key) => {
        const t = CHAT_THEMES[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border transition-colors ${
              active ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
            >
              {active && <Check size={11} className="text-white" />}
            </span>
            <span className="text-[12px] text-white/90">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
