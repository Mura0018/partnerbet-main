"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Stats = {
  fullName: string | null;
  cardLast4: string | null;
  hasCard: boolean;
  volume: number;
  rank: number | null;
  totalRanked: number;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Hero 3D sovrinли karta — mijozning O'Z ma'lumoti (ism, karta oxirgi 4 raqami,
// aylanma, o'rin). Ma'lumot yo'q bo'lsa skeleton (mock raqam YO'Q).
export function PrizeCard({ initData }: { initData: string }) {
  const { t } = useLocale();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/telegram/miniapp/promo/stats?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && !d.error) setStats(d as Stats);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [initData]);

  const onMove = (e: React.PointerEvent) => {
    if (prefersReduced()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateY(${((px - 0.5) * 17).toFixed(2)}deg) rotateX(${((0.5 - py) * 13).toFixed(2)}deg)`;
    el.style.setProperty("--px", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(py * 100).toFixed(1)}%`);
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
    el.style.setProperty("--px", "50%");
    el.style.setProperty("--py", "28%");
  };

  const rank = stats?.rank ?? null;
  const progress = rank && stats?.totalRanked ? Math.max(0.06, 1 - (rank - 1) / stats.totalRanked) : 0;
  const noData = loading || !stats;

  return (
    <div style={{ perspective: 900 }}>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        onPointerUp={reset}
        className="m-prizecard"
        style={{
          aspectRatio: "1.62 / 1",
          background: "linear-gradient(158deg, var(--surf-3) 0%, var(--surf) 60%, var(--surf-2) 100%)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 22px 44px -20px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        {/* rangli nur (yashil-binafsha) */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 120% at 12% 0%, rgba(18,217,160,.16), transparent 55%), radial-gradient(70% 120% at 100% 100%, rgba(139,92,255,.14), transparent 60%)", pointerEvents: "none" }} />

        <div className="m-prizecard-content" style={{ position: "relative", zIndex: 3, height: "100%", padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {/* tepa */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--em)", letterSpacing: 0.3 }}>BetCore</span>
            <span style={{ fontSize: 9.5, letterSpacing: 2, color: "var(--ink-3)", fontWeight: 700 }}>{t("tg.heroLabel")}</span>
          </div>

          {/* karta raqami */}
          <div style={{ fontFamily: "var(--mono)", fontSize: 17, letterSpacing: 3, color: "var(--ink)", textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>
            {noData ? (
              <span className="m-skeleton" style={{ display: "inline-block", width: 168, height: 16, borderRadius: 5 }} />
            ) : (
              <>•••• •••• •••• {stats!.cardLast4 ?? "••••"}</>
            )}
          </div>

          {/* pastki qator: ism + aylanma/o'rin */}
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" }}>{t("tg.heroTurnover")}</div>
                {noData ? (
                  <span className="m-skeleton" style={{ display: "block", width: 96, height: 15, borderRadius: 5, marginTop: 3 }} />
                ) : (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: "var(--em)" }}>{fmt(stats!.volume)}</div>
                )}
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {noData ? (
                    <span className="m-skeleton" style={{ display: "inline-block", width: 120, height: 13, borderRadius: 5 }} />
                  ) : (
                    stats!.fullName || t("tg.heroNoName")
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" }}>{t("tg.heroRank")}</div>
                {noData ? (
                  <span className="m-skeleton" style={{ display: "block", width: 42, height: 20, borderRadius: 5, marginTop: 3, marginLeft: "auto" }} />
                ) : rank ? (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 800, color: "var(--gold)", lineHeight: 1 }}>#{rank}</div>
                ) : (
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4, maxWidth: 78 }}>{t("tg.heroNoRank")}</div>
                )}
              </div>
            </div>

            {/* oltin mikro-chiziq (reyting progress) */}
            <div style={{ marginTop: 10, height: 3, borderRadius: 3, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(progress * 100).toFixed(0)}%`, borderRadius: 3, background: "linear-gradient(90deg, var(--gold), #FFE0A0)", boxShadow: "0 0 8px rgba(255,201,107,.6)", transition: "width .9s cubic-bezier(.22,1,.36,1)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
