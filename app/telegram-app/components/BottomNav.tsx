"use client";

import React from "react";
import { Home, ListOrdered, Gift, Headset } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Mini-app pastki nav — 4 tab. Safe-area inset hurmat qilinadi.
// Faqat asosiy ekranlarda ko'rsatiladi (support to'liq ekran — o'zining back'i bor).
export function BottomNav({ current, onNavigate }: { current: string; onNavigate: (screen: string) => void }) {
  const { t } = useLocale();
  const tabs = [
    { id: "menu", icon: Home, label: t("tg.navHome") },
    { id: "orders", icon: ListOrdered, label: t("tg.navOrders") },
    { id: "promo", icon: Gift, label: t("tg.navPrize") },
    { id: "support", icon: Headset, label: t("tg.navSupport") },
  ];
  return (
    <nav
      className="m-divider-gradient"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        background: "rgba(10, 18, 32, 0.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((tb) => {
        const active = current === tb.id;
        return (
          <button
            key={tb.id}
            onClick={() => onNavigate(tb.id)}
            style={{
              all: "unset",
              cursor: "pointer",
              height: 58,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: active ? "var(--em)" : "var(--ink-3)",
              transition: "color .2s",
            }}
            aria-label={tb.label}
          >
            <tb.icon size={20} style={active ? { filter: "drop-shadow(0 3px 7px rgba(18,217,160,.6))", transform: "translateY(-1px)" } : undefined} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, textShadow: active ? "0 0 10px rgba(18,217,160,.5)" : "none" }}>{tb.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
