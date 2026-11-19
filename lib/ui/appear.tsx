"use client";

import React, { useEffect, useState } from "react";

// =========================================================
// "Chaqnab o'tish" va sahifa sakrashiga qarshi ikki kichik yordamchi.
//
//  <Appear> — blok paydo bo'lganda keskin sakramasdan, balandligi 0 dan
//    yumshoq ochiladi + shaffoflik (globals.css: .ui-appear). Holat noma'lum
//    paytda komponent hech narsa chizmaydi (null), natija kelganda <Appear>
//    bilan qaytaradi. prefers-reduced-motion'da animatsiya o'chadi.
//
//  useDelayedFlag(active, ms) — `active` ms davomida uzluksiz true bo'lsagina
//    true qaytaradi. Tez qaytgan so'rovda "Yuklanmoqda…" umuman chiqmaydi;
//    cho'zilsa — chiqadi (foydalanuvchi hech narsa yo'qotmaydi).
// =========================================================

export function Appear({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-appear">
      <div className="ui-appear-inner">{children}</div>
    </div>
  );
}

export const LOADING_TEXT_DELAY_MS = 400;

export function useDelayedFlag(active: boolean, delayMs: number = LOADING_TEXT_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const tm = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(tm);
  }, [active, delayMs]);
  return active && shown;
}
