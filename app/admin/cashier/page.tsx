"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSiteTimezone } from "@/lib/site/SiteTimezoneProvider";
import { formatPhone, formatDateTime } from "@/lib/format";
import { QrCode, Camera, X, Search, Loader2, User, CheckCircle2, AlertTriangle, Star, Plus, Link2 } from "lucide-react";

type Account = { player_id: string; player_name: string | null; is_primary: boolean; verified: boolean; source: string };
type Order = { id: string; type: string; amount: number; status: string; platform: string; created_at: string };
type Customer = { id: string; full_name: string | null; phone: string; created_at: string | null };
type Resolved =
  | { found: true; via: string; cardCode?: string; playerId?: string; customer: Customer; accounts: Account[]; orders: Order[]; activity: { volume: number; orders_count: number } }
  | { found: false; reason: string; code?: string; lookup?: { player_id: string; name: string | null } };

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
const STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending: { labelKey: "ord.statusPending", cls: "text-[#F4C76A]" },
  completed: { labelKey: "ord.statusCompleted", cls: "text-[#4ADE80]" },
  rejected: { labelKey: "ord.statusRejected", cls: "text-[#FF6B85]" },
};

export default function CashierPage() {
  const { t } = useLocale();
  const tz = useSiteTimezone();
  const fmtDt = (s: string | null) => formatDateTime(s, { timeZone: tz });

  const [mode, setMode] = useState<"code" | "id">("code");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<Resolved | null>(null);
  const last = useRef<{ kind: "code" | "id"; value: string } | null>(null);

  // Kamera
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const cameraSupported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  // ID qo'shish (tasdiqlash bilan)
  const [newId, setNewId] = useState("");
  const [verifyName, setVerifyName] = useState<string | null>(null);
  const [verifyDone, setVerifyDone] = useState(false); // tekshiruv chaqirildi
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null); // asosiy/tasdiq amali

  const resolve = async (kind: "code" | "id", value: string) => {
    const v = value.trim();
    if (!v) return;
    last.current = { kind, value: v };
    setLoading(true);
    setError("");
    setData(null);
    setNewId(""); setVerifyName(null); setVerifyDone(false);
    try {
      const qs = kind === "code" ? `code=${encodeURIComponent(v)}` : `playerId=${encodeURIComponent(v)}`;
      const res = await fetch(`/api/admin/cashier/resolve?${qs}`);
      const d = await res.json();
      if (!res.ok) { setError(t("kas.errGeneric")); return; }
      setData(d);
    } catch {
      setError(t("kas.errConn"));
    } finally {
      setLoading(false);
    }
  };
  const reload = () => { if (last.current) resolve(last.current.kind, last.current.value); };

  // ---- Kamera ----
  const stopCamera = () => {
    stopRef.current = true;
    setScanning(false);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };
  const startCamera = async () => {
    setError(""); stopRef.current = false; setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (stopRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length) { const val = codes[0].rawValue as string; stopCamera(); setMode("code"); setInput(val); resolve("code", val); return; }
        } catch { /* frame */ }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch { setScanning(false); setError(t("mon.errCamera")); }
  };
  useEffect(() => () => stopCamera(), []);

  // ---- ID qo'shish oqimi ----
  const customerId = data && data.found ? data.customer.id : null;

  const verifyNewId = async () => {
    const pid = newId.trim();
    if (!pid) return;
    setVerifyBusy(true); setVerifyName(null); setVerifyDone(false);
    try {
      const res = await fetch(`/api/admin/customers/verify-player?playerId=${encodeURIComponent(pid)}`);
      const d = await res.json();
      setVerifyName(d.ok ? d.name : null);
    } catch {
      setVerifyName(null);
    } finally {
      setVerifyBusy(false); setVerifyDone(true);
    }
  };
  const saveNewId = async (verified: boolean) => {
    if (!customerId) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/customers/bet-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, action: "add", playerId: newId.trim(), playerName: verifyName || undefined, verified }),
      });
      if (res.ok) { setNewId(""); setVerifyName(null); setVerifyDone(false); reload(); }
    } finally {
      setAddBusy(false);
    }
  };
  const setPrimary = async (pid: string) => {
    if (!customerId) return;
    setRowBusy(pid);
    try {
      const res = await fetch("/api/admin/customers/bet-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, action: "primary", playerId: pid }),
      });
      if (res.ok) reload();
    } finally { setRowBusy(null); }
  };
  const verifyExisting = async (pid: string) => {
    if (!customerId) return;
    setRowBusy(pid);
    try {
      const chk = await fetch(`/api/admin/customers/verify-player?playerId=${encodeURIComponent(pid)}`);
      const cd = await chk.json();
      if (!cd.ok) { setRowBusy(null); alert(t("kas.verifyFail")); return; }
      const res = await fetch("/api/admin/customers/bet-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, action: "verify", playerId: pid, playerName: cd.name }),
      });
      if (res.ok) reload();
    } finally { setRowBusy(null); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><QrCode size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">{t("kas.title")}</h1>
          <p className="text-xs text-white/40">{t("kas.subtitle")}</p>
        </div>
      </div>

      {/* QR skaner (asosiy) */}
      {scanning ? (
        <div className="relative rounded-2xl overflow-hidden border border-subtle mb-3 bg-black">
          <video ref={videoRef} className="w-full max-h-[55vh] object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-44 h-44 border-2 border-[#1CE0C3]/70 rounded-2xl" /></div>
          <button onClick={stopCamera} className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white"><X size={18} /></button>
        </div>
      ) : (
        cameraSupported && (
          <button onClick={startCamera} className="w-full mb-3 py-3 rounded-2xl bg-[#1CE0C3] text-[#04231F] font-semibold flex items-center justify-center gap-2"><Camera size={18} /> {t("kas.scan")}</button>
        )
      )}

      {/* Qo'lda: karta kodi yoki 1xBet ID (teng) */}
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => setMode("code")} className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold border ${mode === "code" ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted"}`}>{t("kas.byCode")}</button>
        <button onClick={() => setMode("id")} className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold border ${mode === "id" ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted"}`}>{t("kas.byId")}</button>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && resolve(mode, input)}
          placeholder={mode === "code" ? t("kas.phCode") : t("kas.phId")}
          className="flex-1 bg-white/5 border border-subtle rounded-lg py-2.5 px-3.5 text-white text-sm outline-none focus:border-accent font-mono" />
        <button onClick={() => resolve(mode, input)} disabled={loading} className="px-4 rounded-lg bg-accent/20 text-white font-medium hover:bg-accent/30 disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} {t("kas.find")}
        </button>
      </div>

      {error && <div className="rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85] text-[12.5px] px-3 py-2.5 mb-2">{error}</div>}

      {/* Topilmadi / bog'lanmagan */}
      {data && !data.found && (
        <div className="mt-2 rounded-2xl border border-[#F4C76A]/30 bg-[#F4C76A]/[0.06] p-4">
          {data.reason === "unlinked" && data.lookup ? (
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-[#F4C76A]/15 flex items-center justify-center text-[#F4C76A] shrink-0"><Link2 size={18} /></span>
              <div className="min-w-0">
                <div className="text-white font-semibold text-[14px]">{t("kas.unlinked")}</div>
                <div className="text-[12.5px] text-white/70 mt-0.5">ID: <span className="font-mono">{data.lookup.player_id}</span></div>
                {data.lookup.name ? (
                  <div className="text-[12.5px] text-[#4ADE80] mt-0.5">{data.lookup.name}</div>
                ) : (
                  <div className="text-[12px] text-white/40 mt-0.5">{t("kas.noName")}</div>
                )}
                <div className="text-[11px] text-white/40 mt-1.5">{t("kas.unlinkedHint")}</div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-white/70">
              {data.reason === "card_blank" ? t("kas.cardBlank") : data.reason === "card_cancelled" ? t("kas.cardCancelled") : data.reason === "card_not_found" ? t("mon.errNotFound") : t("kas.notFound")}
            </div>
          )}
        </div>
      )}

      {/* Mijoz topildi */}
      {data && data.found && (
        <div className="mt-2 rounded-2xl glass-card overflow-hidden">
          <div className="p-4 border-b border-subtle flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-[#1CE0C3]/10 flex items-center justify-center text-[#1CE0C3]"><User size={20} /></span>
            <div className="min-w-0">
              <div className="text-white font-bold text-[15px]">{data.customer.full_name || formatPhone(data.customer.phone)}</div>
              <div className="text-[12px] text-white/40">{formatPhone(data.customer.phone)} · {t("mon.activity")}: {fmt(data.activity.volume)} · {data.activity.orders_count} {t("mon.orders")}</div>
            </div>
          </div>

          {/* 1xBet ID lari — asosiy / tasdiqlash / tasdiqlanmagan belgi */}
          <div className="p-3 border-b border-subtle">
            <div className="text-[11px] text-white/40 mb-1.5">{t("mon.accountsTitle")}</div>
            {data.accounts.length === 0 ? (
              <div className="text-[12px] text-white/30 py-1">{t("mon.noAccounts")}</div>
            ) : (
              <div className="space-y-1.5">
                {data.accounts.map((a) => (
                  <div key={a.player_id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-white">{a.player_id}</span>
                      {a.player_name && <span className="text-white/40 truncate">{a.player_name}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {a.is_primary ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1CE0C3]/15 text-[#1CE0C3] flex items-center gap-0.5"><Star size={10} /> {t("mon.primary")}</span>
                      ) : (
                        <button onClick={() => setPrimary(a.player_id)} disabled={rowBusy === a.player_id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-subtle text-white/60 hover:text-white disabled:opacity-50">{t("kas.makePrimary")}</button>
                      )}
                      {a.verified ? (
                        <CheckCircle2 size={13} className="text-[#4ADE80]" />
                      ) : (
                        <button onClick={() => verifyExisting(a.player_id)} disabled={rowBusy === a.player_id}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F4C76A]/15 text-[#F4C76A] disabled:opacity-50">
                          {rowBusy === a.player_id ? <Loader2 size={10} className="animate-spin" /> : <AlertTriangle size={10} />} {t("kas.verifyBtn")}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Yangi ID qo'shish — TASDIQLASH bilan */}
            <div className="mt-3 pt-2.5 border-t border-subtle">
              <div className="flex gap-2">
                <input value={newId} onChange={(e) => { setNewId(e.target.value); setVerifyName(null); setVerifyDone(false); }} placeholder={t("kas.addIdPh")}
                  className="flex-1 bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-white text-[12px] outline-none focus:border-accent font-mono" />
                <button onClick={verifyNewId} disabled={verifyBusy || !newId.trim()}
                  className="px-3 rounded-lg bg-white/10 border border-subtle text-white text-[12px] font-medium disabled:opacity-50 flex items-center gap-1.5">
                  {verifyBusy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} {t("kas.check")}
                </button>
              </div>
              {verifyDone && (
                <div className="mt-2">
                  {verifyName ? (
                    <div className="rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/30 p-2.5">
                      <div className="text-[12px] text-white mb-2">{t("kas.foundName")}: <span className="font-semibold text-[#4ADE80]">{verifyName}</span> — {t("kas.confirmQ")}</div>
                      <div className="flex gap-2">
                        <button onClick={() => saveNewId(true)} disabled={addBusy} className="flex-1 py-1.5 rounded-lg bg-[#4ADE80]/20 border border-[#4ADE80]/40 text-[#4ADE80] font-semibold text-[12px] disabled:opacity-50">{addBusy ? <Loader2 size={12} className="animate-spin mx-auto" /> : t("kas.confirmSave")}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-[#F4C76A]/10 border border-[#F4C76A]/30 p-2.5">
                      <div className="text-[12px] text-[#F4C76A] mb-2">{t("kas.noNameSave")}</div>
                      <button onClick={() => saveNewId(false)} disabled={addBusy} className="w-full py-1.5 rounded-lg bg-white/10 border border-subtle text-white/80 font-semibold text-[12px] disabled:opacity-50">{addBusy ? <Loader2 size={12} className="animate-spin mx-auto" /> : t("kas.saveUnverified")}</button>
                    </div>
                  )}
                </div>
              )}
              {!verifyDone && <div className="text-[10.5px] text-white/30 mt-1"><Plus size={10} className="inline" /> {t("kas.addIdHint")}</div>}
            </div>
          </div>

          {/* So'nggi buyurtmalar */}
          <div className="p-3">
            <div className="text-[11px] text-white/40 mb-1.5">{t("mon.recentOrders")}</div>
            {data.orders.length === 0 ? (
              <div className="text-[12px] text-white/30 py-2">{t("mon.noOrders")}</div>
            ) : (
              <div className="space-y-1.5">
                {data.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-white/70">{o.type === "topup" ? t("ord.topup") : t("ord.withdraw")} · {o.platform}</span>
                    <span className="flex items-center gap-3"><span className="text-white">{fmt(o.amount)}</span><span className={STATUS[o.status]?.cls ?? "text-white/50"}>{STATUS[o.status] ? t(STATUS[o.status].labelKey as any) : o.status}</span></span>
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
