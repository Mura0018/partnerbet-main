"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSiteTimezone } from "@/lib/site/SiteTimezoneProvider";
import { formatPhone, formatDateTime } from "@/lib/format";
import React, { useEffect, useRef, useState } from "react";
import { QrCode, Loader2, Camera, X, User, Search, Link2, Ban, CheckCircle2, AlertTriangle } from "lucide-react";

type Account = { player_id: string; player_name: string | null; is_primary: boolean; verified: boolean };
type Result = {
  cardState: "blank" | "assigned" | "cancelled";
  card: { code: string; cancel_reason?: string | null; cancelled_at?: string | null; assigned_at?: string | null };
  customer?: { id: string; full_name: string | null; phone: string; created_at: string | null };
  accounts?: Account[];
  activity?: { volume: number; orders_count: number };
  orders?: { id: string; type: string; amount: number; status: string; platform: string; created_at: string }[];
  scanCount?: number;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
const STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending: { labelKey: "ord.statusPending", cls: "text-[#F4C76A]" },
  completed: { labelKey: "ord.statusCompleted", cls: "text-[#4ADE80]" },
  rejected: { labelKey: "ord.statusRejected", cls: "text-[#FF6B85]" },
};

export default function PromoScanPage() {
  const [code, setCode] = useState("");
  const { t } = useLocale();
  const tz = useSiteTimezone();
  const fmtDt = (s: string | null) => formatDateTime(s, { timeZone: tz });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  const cameraSupported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  const lookup = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/promo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error === "not_found" ? t("mon.errNotFound") : t("mon.errGeneric"));
        return;
      }
      setResult(d);
    } catch {
      setError(t("mon.errConn"));
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    stopRef.current = true;
    setScanning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setError("");
    stopRef.current = false;
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (stopRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length) {
            const val = codes[0].rawValue as string;
            stopCamera();
            setCode(val);
            lookup(val);
            return;
          }
        } catch {
          /* frame o'qilmadi — davom */
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setScanning(false);
      setError(t("mon.errCamera"));
    }
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><QrCode size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">{t("mon.scanTitle")}</h1>
          <p className="text-xs text-white/40">{t("mon.scanSubtitle")}</p>
        </div>
      </div>

      {/* Kamera */}
      {scanning ? (
        <div className="relative rounded-2xl overflow-hidden border border-subtle mb-4 bg-black">
          <video ref={videoRef} className="w-full max-h-[60vh] object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-[#1CE0C3]/70 rounded-2xl" />
          </div>
          <button onClick={stopCamera} className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white"><X size={18} /></button>
        </div>
      ) : (
        cameraSupported && (
          <button onClick={startCamera} className="w-full mb-4 py-3 rounded-2xl bg-[#1CE0C3] text-[#04231F] font-semibold flex items-center justify-center gap-2">
            <Camera size={18} /> {t("mon.enableCamera")}
          </button>
        )
      )}

      {/* Qo'lда kod */}
      <div className="flex gap-2 mb-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup(code)}
          placeholder={t("mon.scanPlaceholder")}
          className="flex-1 bg-white/5 border border-subtle rounded-lg py-2.5 px-3.5 text-white text-sm outline-none focus:border-accent font-mono"
        />
        <button onClick={() => lookup(code)} disabled={loading} className="px-4 rounded-lg bg-accent/20 text-white font-medium hover:bg-accent/30 disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} {t("mon.search")}
        </button>
      </div>
      {!cameraSupported && <p className="text-[11px] text-white/30 mb-2">{t("mon.cameraUnsupported")}</p>}
      {error && <div className="rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85] text-[12.5px] px-3 py-2.5 mb-2">{error}</div>}

      {/* BLANK — biriktirilmagan karta */}
      {result?.cardState === "blank" && (
        <div className="mt-4 rounded-2xl border border-[#2E8FFF]/30 bg-[#2E8FFF]/[0.06] p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-[#2E8FFF]/15 flex items-center justify-center text-[#2E8FFF] shrink-0"><Link2 size={18} /></span>
          <div>
            <div className="text-white font-semibold text-[14px]">{t("mon.cardBlank")}</div>
            <div className="text-[12px] text-white/50 mt-0.5 font-mono">{result.card.code}</div>
          </div>
        </div>
      )}

      {/* CANCELLED — bekor qilingan karta */}
      {result?.cardState === "cancelled" && (
        <div className="mt-4 rounded-2xl border border-[#FF6B85]/30 bg-[#FF6B85]/[0.06] p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-[#FF6B85]/15 flex items-center justify-center text-[#FF6B85] shrink-0"><Ban size={18} /></span>
          <div className="min-w-0">
            <div className="text-[#FF6B85] font-semibold text-[14px]">{t("mon.cardCancelled")}</div>
            <div className="text-[12px] text-white/50 mt-0.5 font-mono">{result.card.code}</div>
            {result.card.cancel_reason && <div className="text-[12px] text-white/60 mt-1.5">{t("mon.cancelReason")}: {result.card.cancel_reason}</div>}
          </div>
        </div>
      )}

      {/* ASSIGNED — mijoz + ID ro'yxati + faollik */}
      {result?.cardState === "assigned" && result.customer && (
        <div className="mt-4 rounded-2xl glass-card overflow-hidden">
          <div className="p-4 border-b border-subtle flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-[#1CE0C3]/10 flex items-center justify-center text-[#1CE0C3]"><User size={20} /></span>
            <div className="min-w-0">
              <div className="text-white font-bold text-[15px]">{result.customer.full_name || formatPhone(result.customer.phone)}</div>
              <div className="text-[12px] text-white/40">{formatPhone(result.customer.phone)} · Ro'yxatdan: {fmtDt(result.customer.created_at)}</div>
            </div>
          </div>

          {/* 1xBet ID lari — tasdiqlanmaganlar belgilangan */}
          <div className="p-3 border-b border-subtle">
            <div className="text-[11px] text-white/40 mb-1.5">{t("mon.accountsTitle")}</div>
            {(result.accounts ?? []).length === 0 ? (
              <div className="text-[12px] text-white/30 py-1">{t("mon.noAccounts")}</div>
            ) : (
              <div className="space-y-1.5">
                {(result.accounts ?? []).map((a) => (
                  <div key={a.player_id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-white">{a.player_id}</span>
                      {a.player_name && <span className="text-white/40 truncate">{a.player_name}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {a.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1CE0C3]/15 text-[#1CE0C3]">{t("mon.primary")}</span>}
                      {a.verified ? (
                        <CheckCircle2 size={13} className="text-[#4ADE80]" />
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F4C76A]/15 text-[#F4C76A]"><AlertTriangle size={11} /> {t("mon.unverified")}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 divide-x divide-subtle border-b border-subtle">
            <div className="p-3 text-center">
              <div className="text-[10px] text-white/40">{t("mon.activity")}</div>
              <div className="text-[15px] font-bold text-[#4ADE80]">{fmt(result.activity?.volume ?? 0)}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10px] text-white/40">{t("mon.orders")}</div>
              <div className="text-[15px] font-bold text-white">{result.activity?.orders_count ?? 0}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10px] text-white/40">{t("mon.scanCount")}</div>
              <div className="text-[15px] font-bold text-[#F4C76A]">{result.scanCount ?? 0}</div>
            </div>
          </div>
          <div className="p-3">
            <div className="text-[11px] text-white/40 mb-1.5">{t("mon.recentOrders")}</div>
            {(result.orders ?? []).length === 0 ? (
              <div className="text-[12px] text-white/30 py-2">{t("mon.noOrders")}</div>
            ) : (
              <div className="space-y-1.5">
                {(result.orders ?? []).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-white/70">{o.type === "topup" ? t("ord.topup") : t("ord.withdraw")} · {o.platform}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-white">{fmt(o.amount)}</span>
                      <span className={STATUS[o.status]?.cls ?? "text-white/50"}>{STATUS[o.status] ? t(STATUS[o.status].labelKey as any) : o.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
