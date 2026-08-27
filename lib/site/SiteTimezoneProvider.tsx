"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/format";

// =====================================================================
//  JONLI SITE VAQT MINTAQASI (F2a) — site_settings.timezone client'ga.
//  Ikki rejim:
//   - `tz` prop berilsa (server layout — mini-app SSR): o'shani ishlatadi,
//     miltillashsiz (mijoz Rossiyada bo'lsa ham site vaqti chiqadi).
//   - `tz` berilmasa (admin — client layout): /api/site/timezone dan BIR
//     marta oladi. Yuklaguncha DEFAULT_TIME_ZONE (Asia/Tashkent = hozirgi
//     qiymat, shuning uchun ko'zga tashlanmaydi).
//  Faqat admin va mini-app layout'lariga qo'yiladi. Ommaviy sahifalar
//  (blog, football) server'da getTimezone() ni o'zi chaqiradi (F2c).
// =====================================================================
const SiteTimezoneContext = createContext<string>(DEFAULT_TIME_ZONE);

export function SiteTimezoneProvider({ tz, children }: { tz?: string; children: React.ReactNode }) {
  const [timeZone, setTimeZone] = useState<string>(tz || DEFAULT_TIME_ZONE);

  useEffect(() => {
    if (tz) return; // SSR qiymati bor — olishning hojati yo'q
    let alive = true;
    fetch("/api/site/timezone")
      .then((r) => r.json())
      .then((d) => { if (alive && d?.tz) setTimeZone(String(d.tz)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [tz]);

  return <SiteTimezoneContext.Provider value={timeZone}>{children}</SiteTimezoneContext.Provider>;
}

// Client komponentlar site mintaqasini shu hook orqali oladi va formatX'ga
// uzatadi: const tz = useSiteTimezone(); formatDateTime(x, { timeZone: tz }).
export function useSiteTimezone(): string {
  return useContext(SiteTimezoneContext);
}
