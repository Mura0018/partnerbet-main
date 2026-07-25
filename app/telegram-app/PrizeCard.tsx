"use client";

import React, { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import QRCode from "qrcode";
import { Loader2, Gift, Sparkles, QrCode } from "lucide-react";

// B8: 3D sovrin kartasi. Mijoz "Kartani oching" bosса — flip animatsiyasi bilan
// ochiladi, kod + QR chiqadi (QR C-bosqich skaner uchun). 1xbet "hissi"
// (premium yashil-oltin), lekin 1xbet logosi YO'Q. claim API'ga ulanadi.

type Card = { card_code: string; claimed_at: string };

export function PrizeCard({ initData }: { initData: string }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/telegram/miniapp/promo/claim?initData=${encodeURIComponent(initData)}`);
        const d = await res.json();
        if (res.ok) {
          setEnabled(!!d.enabled);
          if (d.card) { setCard(d.card); setFlipped(true); }
        }
      } catch {
        /* jim */
      } finally {
        setLoading(false);
      }
    })();
  }, [initData]);

  useEffect(() => {
    if (card?.card_code) {
      QRCode.toDataURL(card.card_code, { margin: 1, width: 260, color: { dark: "#0A1220", light: "#ffffff" } })
        .then(setQr)
        .catch(() => {});
    }
  }, [card?.card_code]);

  const claim = async () => {
    setClaiming(true);
    setError("");
    try {
      const res = await fetch("/api/telegram/miniapp/promo/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error === "promo_disabled" ? t("pz.ePromoOff") : t("pz.eGeneric"));
        return;
      }
      setCard(d.card);
      setTimeout(() => setFlipped(true), 120);
    } catch {
      setError(t("pz.eConn"));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-[var(--ink-2)]"><Loader2 className="animate-spin" /></div>;
  }

  if (!enabled && !card) {
    return (
      <div className="text-center py-20 px-6">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-[var(--gold)]/10 items-center justify-center mb-4"><Gift size={28} className="text-[var(--gold)]" /></div>
        <p className="text-[15px] font-bold text-[var(--ink)] mb-1">{t("pz.soonTitle")}</p>
        <p className="text-[12.5px] text-[var(--ink-2)]">{t("pz.soonSub")}</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2 pb-8">
      {/* 3D KARTA */}
      <div className="mx-auto" style={{ perspective: "1200px", maxWidth: 340 }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1.586",
            transformStyle: "preserve-3d",
            transition: "transform 0.9s cubic-bezier(0.22,1,0.36,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* OLD TARAF (muhrlangan) */}
          <div
            style={{
              position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 20,
              background: "linear-gradient(158deg, var(--surf-3) 0%, var(--surf) 60%, var(--surf-2) 100%)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "0 22px 44px -20px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06)",
              padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle,rgba(18,217,160,0.18),transparent 70%)" }} />
            <div className="flex items-center justify-between">
              <span style={{ fontWeight: 800, fontSize: 15, color: "var(--em)" }}>BetCore Pay</span>
              <Sparkles size={16} className="text-[var(--gold)]" />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--ink-3)" }}>{t("pz.prizeCard")}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>{t("pz.closed")}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 22, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.15)" }} />)}
            </div>
          </div>

          {/* ORQA TARAF (ochilgan — kod + QR) */}
          <div
            style={{
              position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 20,
              background: "linear-gradient(158deg, var(--surf-3) 0%, var(--surf) 60%, var(--surf-2) 100%)",
              border: "1px solid rgba(255,201,107,0.4)",
              boxShadow: "0 22px 44px -20px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06)",
              padding: 16, display: "flex", alignItems: "center", gap: 14, overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", bottom: -50, left: -50, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,201,107,0.16),transparent 70%)" }} />
            <div style={{ background: "rgba(255,255,255,.98)", borderRadius: 12, padding: 6, flexShrink: 0 }}>
              {qr ? <img src={qr} alt="QR" style={{ width: 96, height: 96, display: "block" }} /> : <div style={{ width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}><QrCode size={40} className="text-[var(--surf)]" /></div>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: "var(--gold)", fontWeight: 700 }}>{t("pz.prizeCard")}</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", margin: "6px 0 2px" }}>{t("pz.cardCode")}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 800, color: "var(--ink)", letterSpacing: 1 }}>{card?.card_code}</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 8 }}>{t("pz.showOperator")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* HOLAT / TUGMA */}
      <div className="mt-6 text-center">
        {card ? (
          <p className="text-[12.5px] text-[var(--ink-2)]">{t("pz.claimed")}</p>
        ) : (
          <>
            {error && <p className="text-[12.5px] text-[var(--red)] mb-3">{error}</p>}
            <button
              onClick={claim}
              disabled={claiming}
              className="w-full max-w-[300px] mx-auto py-3.5 rounded-2xl font-extrabold text-[15px] text-[var(--bg)] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(120deg, var(--gold), var(--em), var(--gold))", backgroundSize: "200% 100%", animation: "prizeShine 3s linear infinite", boxShadow: "0 10px 30px rgba(18,217,160,0.3)" }}
            >
              {claiming ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />} {t("pz.openCard")}
            </button>
            <p className="text-[11px] text-[var(--ink-3)] mt-3">{t("pz.onceOnly")}</p>
          </>
        )}
      </div>

      <style>{`@keyframes prizeShine { 0%{background-position:0% 0} 100%{background-position:200% 0} }`}</style>
    </div>
  );
}
