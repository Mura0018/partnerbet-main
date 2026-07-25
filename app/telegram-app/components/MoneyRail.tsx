"use client";

import React, { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type RailOrder = {
  type: "topup" | "withdraw";
  status: "pending" | "completed" | "rejected";
  operator_name?: string | null;
  created_at: string;
  // order_confirmations'da shu buyurtma uchun haqiqiy tasdiq (confirmed=true) bormi.
  payment_confirmed?: boolean;
};

// 4 bekatli pul yo'li:
//   1 Yuborildi            : pending & operator yo'q
//   2 Operator qabul qildi  : pending & operator bor
//   3 To'lov tasdiqlandi    : order_confirmations'da HAQIQIY tasdiq (confirmed=true)
//   4 1xbet hisobingizda    : completed
//   rejected                : qizil "Rad etildi"
// Tasdiq ixtiyoriy — yozuv bo'lmasa, 3-bekat YONMAYDI (ko'rsatilmaydi) va
// buyurtma tugallangan bo'lsa rail 2-bekatdan to'g'ridan-to'g'ri 4-bekatga
// o'tadi. Pul yo'li (fill chizig'i) baribir 100% ga to'ladi — buyurtma
// haqiqatan tugallangan, faqat 3-bekatning o'zi dalilsiz qolgan.
export function MoneyRail({ order }: { order: RailOrder }) {
  const { t } = useLocale();
  const [elapsed, setElapsed] = useState("");

  const rejected = order.status === "rejected";
  const completed = order.status === "completed";
  const hasOp = !!order.operator_name;
  const paymentConfirmed = !!order.payment_confirmed;
  const lit: boolean[] = completed
    ? [true, true, paymentConfirmed, true]
    : hasOp
    ? [true, true, false, false]
    : [true, false, false, false];
  const fill = completed ? 1 : hasOp ? 0.5 : 0.12; // 2-bekatda 3 tomon yarim (vizual)

  useEffect(() => {
    if (completed || rejected) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000));
      const m = Math.floor(s / 60);
      setElapsed(m >= 60 ? `${Math.floor(m / 60)}s ${m % 60}m` : `${m}:${String(s % 60).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order.created_at, completed, rejected]);

  const STATIONS = [t("tg.rail1"), t("tg.rail2"), t("tg.rail3"), t("tg.rail4")];
  const trackColor = rejected ? "var(--red)" : "var(--em)";

  return (
    <div style={{ marginTop: 12 }}>
      {/* ETA / holat */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: 0.5, color: completed ? "var(--gold)" : rejected ? "var(--red)" : "var(--ink-3)" }}>
          {completed ? t("tg.railReady") : rejected ? t("tg.railRejected") : elapsed}
        </span>
      </div>

      {/* track */}
      <div style={{ position: "relative", height: 3, borderRadius: 3, background: "rgba(255,255,255,.06)" }}>
        {!rejected && (
          <div
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 3,
              width: `${(fill * 100).toFixed(0)}%`,
              background: "linear-gradient(90deg, var(--cy), var(--em))",
              boxShadow: "0 0 8px rgba(18,217,160,.5)",
              transition: "width .9s cubic-bezier(.4,0,.2,1)",
            }}
          />
        )}
        {rejected && <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: "var(--red)", opacity: 0.5 }} />}

        {/* kometa (yakunlanmagan) */}
        {!completed && !rejected && (
          <div style={{ position: "absolute", top: "50%", left: `${(fill * 100).toFixed(0)}%`, transform: "translate(-50%, -50%)", width: 7, height: 7 }}>
            <span className="m-comet-ring" style={{ position: "absolute", top: "50%", left: "50%", width: 7, height: 7, borderRadius: 999, border: "2px solid rgba(255,255,255,.92)" }} />
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 7, height: 7, borderRadius: 999, background: "rgba(255,255,255,.95)", boxShadow: "0 0 8px rgba(255,255,255,.7)" }} />
          </div>
        )}
      </div>

      {/* bekatlar */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        {STATIONS.map((label, i) => {
          const on = !rejected && lit[i];
          const isLast = i === 3;
          const dot = rejected ? (i === 0 ? "var(--red)" : "#2a3a52") : on ? (isLast && completed ? "var(--gold)" : trackColor) : "#2a3a52";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24%" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, boxShadow: on ? `0 0 7px ${dot}` : "none" }} />
              <span style={{ fontSize: 8.5, marginTop: 4, textAlign: "center", lineHeight: 1.15, color: on ? "var(--ink-2)" : "var(--ink-3)" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
