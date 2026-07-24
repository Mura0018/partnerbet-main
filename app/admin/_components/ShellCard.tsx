"use client";

import React, { useEffect, useRef, useState } from "react";
import { Clock, Pause, Play, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ShellData } from "@/lib/admin/useShellData";

const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("ru-RU"));

// 3D balans hero kartasi. FAQAT canManageOrders (BetCore) foydalanuvchiga chiqadi.
// Ma'lumot layout'dagi yagona useShellData'dan prop orqali keladi (takror poll yo'q).
export function ShellCard({ data, onRefresh }: { data: ShellData | null; onRefresh: () => void }) {
  const { t } = useLocale();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 30 });
  const [busyPending, setBusyPending] = useState(false);
  const [slaLabel, setSlaLabel] = useState<string | null>(null);
  const [slaState, setSlaState] = useState<"ok" | "warn" | "bad">("ok");

  // SLA sanoq (har soniya) — deadline'dan qolgan vaqt
  useEffect(() => {
    const dl = data?.slaDeadline;
    if (!dl) {
      setSlaLabel(null);
      return;
    }
    const tick = () => {
      const remain = Math.floor((new Date(dl).getTime() - Date.now()) / 1000);
      if (remain <= 0) {
        setSlaLabel(t("shl.slaOver"));
        setSlaState("bad");
        return;
      }
      const m = Math.floor(remain / 60);
      const sc = String(remain % 60).padStart(2, "0");
      setSlaLabel(`${m}:${sc}`);
      setSlaState(remain > 60 ? "ok" : "warn");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.slaDeadline, t]);

  if (!data || !data.shell || !data.canManageOrders) return null;

  const bal = data.balance;
  const me = data.me;
  const c = data.counts;
  const limit = bal?.limit ?? null;
  const balance = bal?.balance ?? null;
  const pct = limit && balance != null ? Math.max(0, Math.min(100, (balance / limit) * 100)) : null;
  const low = pct != null && pct < 25;
  const isBusy = !!me?.isBusy;

  const onMove = (e: React.PointerEvent) => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (px * 2 - 1) * 5, y: (py * 2 - 1) * 4, gx: 20 + px * 60, gy: 15 + py * 55 });
  };
  const onLeave = () => setTilt({ x: 0, y: 0, gx: 50, gy: 30 });

  const toggleBusy = async () => {
    if (busyPending) return;
    setBusyPending(true);
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from("profiles").update({ is_busy: !isBusy }).eq("id", auth.user.id);
        onRefresh();
      }
    } finally {
      setBusyPending(false);
    }
  };

  const accent = isBusy ? "#FFB020" : low ? "#FF6B4D" : "#2E8FFF";
  const accent2 = isBusy ? "#8B5CFF" : low ? "#FFB020" : "#8B5CFF";

  return (
    <div className="px-3 pt-2 pb-1" style={{ perspective: 900 }}>
      <div
        ref={cardRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative rounded-2xl overflow-hidden"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${(-tilt.y).toFixed(2)}deg) rotateY(${tilt.x.toFixed(2)}deg)`,
          transition: "transform .15s ease-out",
          background: "linear-gradient(165deg,#16243C 0%,#0D1727 55%,#0A1322 100%)",
          boxShadow: `0 18px 34px -14px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.08)`,
        }}
      >
        {/* rangli nur */}
        <div className="absolute -inset-2 -z-10 rounded-3xl opacity-25 blur-2xl" style={{ background: `linear-gradient(90deg,${accent},${accent2})` }} />
        {/* yuqori yorug' chiziq */}
        <div className="absolute inset-x-0 top-0 h-[1.5px]" style={{ background: `linear-gradient(90deg,transparent,${accent},${accent2},transparent)` }} />

        <div className="relative p-3.5">
          {/* header */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.12em] uppercase text-[#5A6982]">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isBusy ? "#FFB020" : "#28C76F" }} />
                {data.deskName || t("shl.deskGeneral")}
              </div>
              <div className="mt-1 font-mono font-semibold text-[22px] leading-none tabular-nums text-white" style={{ textShadow: "0 3px 12px rgba(0,0,0,.55)" }}>
                {bal?.configured === false ? t("shl.notConfigured") : fmt(balance)}
                {balance != null && <span className="text-[11px] text-[#96A5BD] font-sans ml-1">{t("shl.som")}</span>}
              </div>
              {c && (
                <div className="mt-1 text-[10.5px] font-mono text-[#5A6982]">
                  <b className="text-[#28C76F]">{c.onlineOperators}</b>/{c.totalOperators} {t("shl.faol")}
                </div>
              )}
            </div>
            {/* band tugmasi */}
            <button
              onClick={toggleBusy}
              disabled={busyPending}
              aria-pressed={isBusy}
              className="shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all active:translate-y-[2px] disabled:opacity-50"
              style={{
                background: isBusy ? "linear-gradient(160deg,#4A3312,#2A1D08)" : "linear-gradient(160deg,#1B2B47,#101B2E)",
                boxShadow: isBusy ? "0 4px 0 -1px #1A1204, 0 1px 0 rgba(255,255,255,.14) inset" : "0 4px 0 -1px #0A1220, 0 1px 0 rgba(255,255,255,.13) inset",
              }}
            >
              {isBusy ? <Pause size={15} style={{ color: "#FFB020" }} /> : <Play size={15} style={{ color: "#96A5BD" }} />}
              <span className="text-[8px] font-bold tracking-wide" style={{ color: isBusy ? "#FFB020" : "#5A6982" }}>
                {isBusy ? t("shl.busy") : t("shl.free")}
              </span>
            </button>
          </div>

          {/* meter */}
          {pct != null && (
            <div className="mt-3 h-[7px] rounded-full overflow-hidden relative" style={{ background: "#060C16", boxShadow: "0 2px 4px rgba(0,0,0,.7) inset" }}>
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${pct}%`,
                  background: low ? "linear-gradient(90deg,#FFB020,#FF6B4D)" : "linear-gradient(90deg,#2E8FFF,#8B5CFF)",
                  boxShadow: low ? "0 0 12px rgba(255,176,32,.6)" : "0 0 12px rgba(46,143,255,.7)",
                }}
              />
            </div>
          )}

          {/* chiplar */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {slaLabel && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                style={{
                  background: slaState === "ok" ? "rgba(46,143,255,.16)" : slaState === "warn" ? "rgba(255,176,32,.17)" : "rgba(255,77,106,.19)",
                  color: slaState === "ok" ? "#7BB8FF" : slaState === "warn" ? "#FFC65C" : "#FF93A7",
                }}
              >
                <Clock size={12} /> {t("shl.sla")} <span className="font-mono tabular-nums">{slaLabel}</span>
              </span>
            )}
            {c && c.pendingOrders > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: "rgba(255,77,106,.16)", color: "#FF93A7" }}>
                <span className="font-mono tabular-nums">{c.pendingOrders}</span>
              </span>
            )}
            {me && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg font-mono" style={{ background: me.rating >= 0 ? "rgba(40,199,111,.14)" : "rgba(255,77,106,.16)", color: me.rating >= 0 ? "#28C76F" : "#FF93A7" }}>
                {me.rating > 0 ? `+${me.rating}` : me.rating}
              </span>
            )}
          </div>

          {/* past kassa ogohlantirishi */}
          {c?.cashdesksLow ? (
            <div className="mt-2.5 flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11.5px]" style={{ background: "rgba(255,176,32,.12)", border: "1px solid rgba(255,176,32,.26)", color: "#FFCE7A" }}>
              <AlertTriangle size={13} className="shrink-0" />
              {t("shl.lowCashdesk", { n: c.cashdesksLow })}
            </div>
          ) : null}

          {/* gloss */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(120px 90px at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,.12), transparent 65%)` }} />
        </div>
      </div>
    </div>
  );
}
