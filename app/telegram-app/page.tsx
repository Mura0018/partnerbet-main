"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  Download, ArrowUpFromLine, ListOrdered, Headset, Loader2, ChevronLeft, ChevronDown, Send, CheckCircle2, XCircle, Clock, Upload, Paperclip, Mic, Trash2, Check, Home, LogOut, Reply, Palette, RotateCcw, Pencil, Copy,
  Handshake, Sparkles, ShieldCheck, Globe, Rocket, ArrowRight, Building2, Users, Wallet, Gift,
} from "lucide-react";
import { applyAppTheme } from "@/lib/telegram/appThemes";
import { PrizeCard } from "./PrizeCard";
import { PrizeCard as HeroPrizeCard } from "./components/PrizeCard";
import { MoneyRail } from "./components/MoneyRail";
import { BottomNav } from "./components/BottomNav";
import { PromoBanner } from "./PromoBanner";
import { WithdrawWizard } from "./WithdrawWizard";

declare global {
  interface Window {
    Telegram?: { WebApp: any };
  }
}

type Customer = { id: string; full_name: string | null; phone: string };
type Screen = "loading" | "auth" | "menu" | "topup" | "withdraw" | "orders" | "support" | "order-success" | "forgot-password" | "hamkorlik" | "promo" | "blocked";
type PaymentMethod = "click" | "payme" | "card" | "crypto";

type Order = {
  id: string;
  type: "topup" | "withdraw";
  platform: string;
  account_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: "pending" | "completed" | "rejected";
  operator_note: string | null;
  created_at: string;
  // F2b: kartaning orqasida "qaysi operator" ni ko'rsatish uchun.
  operator_name?: string | null;
  // MoneyRail 3-bekat — order_confirmations'da haqiqiy tasdiq bormi.
  payment_confirmed?: boolean;
  // W2.4: withdraw payout holati — 'none' + payout_attempt_count>0 bo'lsa,
  // avvalgi kod muvaffaqiyatsiz bo'lgan (mijozdan yangisi kutilmoqda).
  payout_status?: "none" | "pending" | "success" | "failed";
  payout_attempt_count?: number;
};

import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { PasswordInput } from "@/lib/ui/PasswordInput";
import { BrandedLoader } from "@/lib/ui/BrandedLoader";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { WithdrawCodeGuide } from "@/lib/ui/WithdrawCodeGuide";
import { ThemePicker } from "@/lib/ui/ThemePicker";
import { chatThemeGradient } from "@/lib/ui/chatThemes";

type SupportMessage = {
  id: string; sender: "customer" | "operator"; message: string | null; image_path: string | null;
  file_name: string | null; voice_path: string | null; voice_duration_seconds: number | null; reply_to_id: string | null; created_at: string;
  // F1: optimistik yuborish uchun — faqat client tomonда (DB emas). `clientId`
  // server id kelгунcha vaqtинча id; `status` yetkazish holati.
  clientId?: string; status?: "sending" | "sent" | "failed";
  // F2e: xabar biriktirilgan buyurtma (karta xabar bilan ketadi).
  order_id?: string | null;
  // F1c/F2: xato bo'lganda "Qayta yuborish" / "Tahrirlash" uchun asl payload
  // (matn yoki rasm).
  _draft?:
    | { kind: "text"; message: string; replyToId: string | null; orderId: string | null }
    | { kind: "image"; imageBase64: string; mimeType: string; fileName: string; caption: string | null };
  // F2: optimistik rasmni upload tugaguncha darhol ko'rsatish uchun mahalliy URL.
  _localImageUrl?: string;
};

// F1/F4: poll (4s) optimistik xabar hali "sending" holatida bo'lganda ham
// serverga yetib borgan bo'lishi mumkin (o'zining deliverSupportMessage
// javobi hali kelmagan) — id bo'yicha solishtirish bunday holatda mos
// kelmaydi (clientId hali server id bilan almashtirilmagan), natijada
// bitta xabar ikki marta ko'rinib qoladi. Mazmuni (yuboruvchi+matn/rasm)
// va vaqt oralig'i bo'yicha taqqoslab, allaqachon kelgan optimistik
// xabarni pending ro'yxatidan chiqarib tashlaymiz.
function optimisticMatchesServer(pending: SupportMessage, serverMsg: SupportMessage): boolean {
  if (pending.sender !== serverMsg.sender) return false;
  const draft = pending._draft;
  if (!draft) return false;
  if (draft.kind === "text") {
    if (serverMsg.message !== draft.message) return false;
  } else if (draft.kind === "image") {
    if ((serverMsg.message ?? null) !== (draft.caption ?? null)) return false;
    if (!serverMsg.image_path) return false;
  }
  const dt = Math.abs(new Date(serverMsg.created_at).getTime() - new Date(pending.created_at).getTime());
  return dt < 20000;
}

// W1.1: rekvizit endi mustaqil (buyurtmasiz) ko'rilmaydi — bu tur endi
// FAQAT allaqachon yaratilgan bitta topup buyurtmaning tanlangan rekvizitini
// ifodalaydi (POST /orders javobidan yoki GET /payment-info?orderId= dan).
type TopupRequisite = { accountNumber: string; holderName: string; methodType: PaymentMethod };

const PLATFORMS = ["1xBet", "Melbet", "Betwinner", "Boshqa"];
const PAYMENT_METHODS: { id: PaymentMethod; label: string; labelKey?: string }[] = [
  { id: "click", label: "Click" },
  { id: "payme", label: "Payme" },
  { id: "card", label: "Bank kartasi", labelKey: "tg.mCard" },
  { id: "crypto", label: "Crypto (USDT)", labelKey: "tg.mCrypto" },
];
const STATUS_LABEL: Record<Order["status"], { labelKey: string; color: string; icon: any }> = {
  pending: { labelKey: "tg.stPending", color: "#F4C76A", icon: Clock },
  completed: { labelKey: "tg.stCompleted", color: "#4ADE80", icon: CheckCircle2 },
  rejected: { labelKey: "tg.stRejected", color: "#FF6B85", icon: XCircle },
};

const inputCls =
  "w-full bg-[var(--surf-2)] border border-[var(--border-subtle)] rounded-xl py-3.5 px-4 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)] transition-colors " +
  "focus:border-[var(--em)] focus:shadow-[0_0_0_2px_rgba(18,217,160,0.25),0_0_16px_rgba(18,217,160,0.15)]";

const buttonCls =
  "w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-[15px] text-[var(--bg)] " +
  "bg-gradient-to-r from-[var(--em)] to-[var(--cy)] " +
  "shadow-[0_6px_20px_rgba(18,217,160,0.3)] " +
  "active:scale-[0.98] active:shadow-[0_3px_10px_rgba(18,217,160,0.2)] " +
  "transition-all disabled:opacity-50";

const titleShadow = {
  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
};

const menuCardCls =
  "rounded-2xl bg-[var(--surf-2)] border border-[var(--border-subtle)] p-4 text-left " +
  "active:scale-[0.98] transition-all";

const bgCls = "min-h-screen text-[var(--ink)]";

function VoicePlayer({ path, getInitData }: { path: string; getInitData: () => string }) {
  const { t } = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/telegram/miniapp/support/media-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData(), path }),
    })
      .then((r) => r.json())
      .then((data) => setUrl(data.url ?? null))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
  }, [path]);

  if (loading) return <p className="text-[12px] text-white/70">{t("tg.voiceLoading")}</p>;
  if (!url) return <p className="text-[12px] text-[#FF6B85]">{t("tg.voiceFail")}</p>;
  return <audio controls src={url} className="max-w-[190px] h-8" />;
}

// F2: mijoz chat bubble'ida rasmni ko'rsatadi. Optimistik holatda mahalliy
// `localUrl` (upload'gача), aks holda `path` bo'yicha himoyalangan media-url.
function CustomerSupportImage({ localUrl, path, getInitData, onOpen }: { localUrl?: string; path?: string | null; getInitData: () => string; onOpen: (url: string) => void }) {
  const { t } = useLocale();
  const [url, setUrl] = useState<string | null>(localUrl ?? null);
  useEffect(() => {
    if (localUrl) { setUrl(localUrl); return; }
    if (!path) return;
    let alive = true;
    fetch("/api/telegram/miniapp/support/media-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData(), path }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive) setUrl(d.url ?? null); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [localUrl, path]);
  if (!url) return <p className="text-[11px] text-white/70">{t("tg.imgLoading")}</p>;
  // F2b: to'liq ochish sahifa darajasида boshqariladi (BackButton uni yopadi).
  return <img src={url} alt={t("tg.imgAlt")} onClick={() => onOpen(url)} className="max-w-[200px] rounded-lg cursor-zoom-in" />;
}

// F2e: to'liq ekran rasm — qo'lda (ikki barmoq) yaqinlashtirish/surish.
function FullscreenImage({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const startDist = useRef(0);
  const startScale = useRef(1);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      startDist.current = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      startScale.current = scale;
    } else if (ptrs.current.size === 1 && scale > 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(Math.min(4, Math.max(1, startScale.current * (d / startDist.current))));
    } else if (ptrs.current.size === 1 && scale > 1 && dragStart.current) {
      setTx(dragStart.current.tx + (e.clientX - dragStart.current.x));
      setTy(dragStart.current.ty + (e.clientY - dragStart.current.y));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    dragStart.current = null;
    if (ptrs.current.size === 0 && scale <= 1) { setTx(0); setTy(0); }
  };
  return (
    <div
      className="fixed inset-0 bg-black/95 z-[75] flex items-center justify-center overflow-hidden touch-none"
      onClick={() => { if (scale <= 1) onClose(); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={src}
        alt="Rasm"
        draggable={false}
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: ptrs.current.size ? "none" : "transform 0.15s" }}
        className="max-w-full max-h-full object-contain select-none"
      />
      {scale > 1 && (
        <button onClick={(e) => { e.stopPropagation(); setScale(1); setTx(0); setTy(0); }} className="absolute top-4 right-4 text-white/85 text-[12px] bg-white/10 px-3 py-1.5 rounded-full">
          Asl holat
        </button>
      )}
    </div>
  );
}

function FloatingAmbience() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <style>{`
        @keyframes miniFloat {
          0% { transform: translate(0,0) rotate(0deg); }
          25% { transform: translate(14px,-20px) rotate(2deg); }
          50% { transform: translate(-8px,-38px) rotate(-1deg); }
          75% { transform: translate(-18px,-12px) rotate(1.5deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
        .mini-chip { animation: miniFloat 15s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .mini-chip { animation: none; } }
      `}</style>
      <span className="mini-chip absolute top-[8%] left-[6%] text-[13px] font-bold" style={{ color: "rgba(200,220,255,0.16)", animationDelay: "0s" }}>1xBet</span>
      <span className="mini-chip absolute top-[16%] right-[8%] text-[11px] font-bold" style={{ color: "rgba(200,220,255,0.13)", animationDelay: "2s" }}>1xBet</span>
      <span className="mini-chip absolute bottom-[22%] left-[5%] text-[12px] font-bold" style={{ color: "rgba(200,220,255,0.14)", animationDelay: "4s" }}>1xBet</span>
      <span className="mini-chip absolute bottom-[14%] right-[6%] text-[11px] font-bold" style={{ color: "rgba(200,220,255,0.12)", animationDelay: "1s" }}>1xBet</span>
    </div>
  );
}

function AccountIdVerifyField({
  accountId,
  setAccountId,
  getInitData,
}: {
  accountId: string;
  setAccountId: (v: string) => void;
  getInitData: () => string;
}) {
  const { t } = useLocale();
  const [verifying, setVerifying] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const verify = async () => {
    if (!accountId.trim()) return;
    setVerifying(true);
    setNotFound(false);
    try {
      const res = await fetch("/api/telegram/miniapp/verify-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), accountId: accountId.trim() }),
      });
      const data = await res.json();
      if (data.playerName) {
        setVerifiedName(data.playerName);
        setFlipped(true);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mb-3.5">
      <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.accIdLabel")}</label>
      <div style={{ perspective: "1200px" }}>
        <div
          className="relative transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none", minHeight: "50px" }}
        >
          <div className="flex gap-2" style={{ backfaceVisibility: "hidden" }}>
            <input
              className={`${inputCls} flex-1`}
              placeholder={t("tg.accIdPh")}
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setNotFound(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verify(); } }}
            />
            <button
              type="button"
              onClick={verify}
              disabled={verifying || !accountId.trim()}
              className="shrink-0 px-4 rounded-xl bg-gradient-to-br from-[#3D7FFF] to-[#2456c9] text-[13px] font-semibold disabled:opacity-50"
            >
              {verifying ? <Loader2 size={15} className="animate-spin" /> : t("tg.verify")}
            </button>
          </div>
          <div
            className="absolute inset-0 flex items-center gap-3 bg-[var(--surf-2)] border border-[var(--em)]/40 shadow-[0_0_0_1px_rgba(18,217,160,0.12),0_0_16px_rgba(18,217,160,0.15)] rounded-xl px-4"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="w-9 h-9 rounded-full bg-[var(--em)]/15 flex items-center justify-center text-[var(--em)] shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold truncate">{verifiedName}</div>
              <div className="text-[10px] text-[#93a5ba]">ID: {accountId} — {t("tg.confirmed")}</div>
            </div>
            <button type="button" onClick={() => { setFlipped(false); setVerifiedName(null); }} className="shrink-0 text-[11px] text-[#7db8ff]">
              {t("tg.change")}
            </button>
          </div>
        </div>
      </div>
      {notFound && (
        <p className="text-[11px] text-[#F4C76A] mt-1.5">{t("tg.idNotFound")}</p>
      )}
    </div>
  );
}


function ScreenHeader({ title, onBack, onHome }: { title: string; onBack: () => void; onHome?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 mb-5">
      <button onClick={onBack} className="p-2 -ml-2 rounded-lg active:bg-white/5" aria-label={t("tg.back")}>
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-[18px] font-bold flex-1">{title}</h1>
      {onHome && (
        <button onClick={onHome} className="p-2 rounded-lg active:bg-white/5" aria-label={t("tg.home")}>
          <Home size={18} />
        </button>
      )}
    </div>
  );
}

// W1.1: bu yerda endi karta/rekvizit KO'RSATILMAYDI — usul tanlash shunchaki
// buyurtmaga qaysi turdagi rekvizit (karta/Click/Payme/kripto) kerakligini
// belgilaydi. Aniq raqam FAQAT buyurtma yaratilgach, keyingi qadamda
// (server tanlagandan keyin) ko'rinadi — mustaqil "oldindan ko'rish" endi
// mavjud emas.
function PaymentMethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  const { t } = useLocale();
  return (
    <div className="mb-3.5">
      <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.payMethod")}</label>
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
              value === m.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] m-divider text-[#93a5ba]"
            }`}
          >
            {m.labelKey ? t(m.labelKey as any) : m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// W2.4: kod 1xbet'da kiritilgandan operator "1xbetdan yechib olish"ni
// bosgunga qadar eskirishi mumkin. Payout shu sabab bilan muvaffaqiyatsiz
// bo'lsa (payout_status 'none'ga qaytadi), mijozdan yangi kod so'raladi —
// buyurtma bekor qilinmaydi, faqat kodni yangilaydi.
function WithdrawCodeRefresh({
  orderId,
  getInitData,
  onSubmitted,
  inputCls,
  buttonCls,
}: {
  orderId: string;
  getInitData: () => string;
  onSubmitted: () => void;
  inputCls: string;
  buttonCls: string;
}) {
  const { t } = useLocale();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!code.trim()) { setError(t("wz.eCode")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/withdraw/refresh-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), orderId, code: code.trim() }),
      });
      if (!res.ok) {
        setError(t("wz.eGeneric"));
        return;
      }
      setCode("");
      onSubmitted();
    } catch {
      setError(t("wz.eGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 rounded-lg bg-[#F4C76A]/10 border border-[#F4C76A]/25 p-3">
      <p className="text-[11.5px] text-[#F4C76A] mb-2">{t("tg.codeExpired")}</p>
      <input className={`${inputCls} mb-2`} placeholder={t("wz.codePh")} value={code} onChange={(e) => setCode(e.target.value)} />
      <button onClick={submit} disabled={busy} className={buttonCls}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : t("tg.submitCode")}
      </button>
      {error && <p className="text-[11px] text-[#FF6B85] mt-1.5">{error}</p>}
    </div>
  );
}

function PlatformField({
  platform,
  setPlatform,
  customPlatform,
  setCustomPlatform,
}: {
  platform: string;
  setPlatform: (v: string) => void;
  customPlatform: string;
  setCustomPlatform: (v: string) => void;
}) {
  const { t } = useLocale();
  return (
    <>
      <div className="mb-3.5">
        <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.platform")}</label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`py-2.5 rounded-xl text-[13px] font-semibold border ${platform === p ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] m-divider text-[#93a5ba]"}`}
            >
              {p === "Boshqa" ? t("tg.platformOther") : p}
            </button>
          ))}
        </div>
      </div>
      {platform === "Boshqa" && (
        <input
          className={`${inputCls} mb-3.5`}
          placeholder={t("tg.platformPh")}
          value={customPlatform}
          onChange={(e) => setCustomPlatform(e.target.value)}
        />
      )}
    </>
  );
}

// H2: mijoz tomonда matn/rasm yuborishda API xatosini do'stona matnga
// aylantiradi (xom JSON emas). `kind` umumiy fallback matnini tanlaydi.
function supportSendErrorMessage(t: (k: any, v?: any) => string, error: unknown, status: number, kind: "message" | "image"): string {
  if (status === 429 || error === "rate_limited") {
    return t("tg.errRate");
  }
  if (status === 401 || error === "not_registered" || error === "invalid_signature" || error === "not_configured") {
    return t("tg.errSession");
  }
  if (kind === "image" && error === "invalid_image_size") {
    return t("tg.errImgSize");
  }
  return kind === "image"
    ? t("tg.errImgSend")
    : t("tg.errMsgSend");
}

// Part I: kun ajratgichi yorlig'i (Telegram uslubi: Bugun / Kecha / sana).
function dayLabel(t: (k: any, v?: any) => string, iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return t("tg.today");
  if (diffDays === 1) return t("tg.yesterday");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export default function TelegramAppPage() {
  const { t, locale, setLocale } = useLocale();
  const [screen, setScreen] = useState<Screen>("loading");
  // F2b: ochiq overlay (to'liq rasm / rasm preview) ni yopish funksiyasi.
  // BackButton avval shuni yopadi, keyin ekrandan chiqadi.
  const overlayCloserRef = useRef<null | (() => void)>(null);
  // Telegram Mini App BackButton: ichki ekranda ko'rsatiladi, bosilganda
  // menyuga qaytaradi (ilovadan chiqmaydi). Menyuda esa yashiriladi.
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.BackButton) return;
    const isInner = screen === "topup" || screen === "withdraw" || screen === "orders" || screen === "support" || screen === "order-success" || screen === "forgot-password" || screen === "hamkorlik" || screen === "promo";
    const goBack = () => {
      // F2b: avval ochiq overlay (to'liq rasm / rasm preview) yopiladi.
      if (overlayCloserRef.current) { overlayCloserRef.current(); return; }
      setScreen((cur) => {
        if (cur === "forgot-password") return "auth";
        return "menu";
      });
    };
    if (isInner) {
      tg.BackButton.show();
      tg.BackButton.onClick(goBack);
    } else {
      tg.BackButton.hide();
    }
    return () => { try { tg.BackButton.offClick(goBack); } catch {} };
  }, [screen]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Forgot password
  const [fpStep, setFpStep] = useState<"phone" | "code">("phone");
  const [fpPhone, setFpPhone] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpInfo, setFpInfo] = useState("");
  const [fpError, setFpError] = useState("");
  const [fpSubmitting, setFpSubmitting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  // Top-up form
  const [tuPlatform, setTuPlatform] = useState(PLATFORMS[0]);
  const [tuCustomPlatform, setTuCustomPlatform] = useState("");
  const [tuAccountId, setTuAccountId] = useState("");
  const [tuAmount, setTuAmount] = useState("");
  const [tuMethod, setTuMethod] = useState<PaymentMethod>("click");
  // W1.1: buyurtma 2-qadam oxirida yaratiladi — tuOrderId/tuRequisite o'sha
  // javobdan keladi va 3-qadamda (rekvizit ko'rsatish + chek yuklash) ishlatiladi.
  const [tuOrderId, setTuOrderId] = useState<string | null>(null);
  const [tuRequisite, setTuRequisite] = useState<TopupRequisite | null>(null);
  const [tuCreatingOrder, setTuCreatingOrder] = useState(false);
  // W1.4: full_name bo'sh mijozdan bir marta so'raladi (buyurtma
  // yaratishga to'sqinlik qilgan bo'lsa).
  const [tuNeedsFullName, setTuNeedsFullName] = useState(false);
  const [tuFullNameInput, setTuFullNameInput] = useState("");
  const [tuSavingFullName, setTuSavingFullName] = useState(false);
  const [tuReceiptBase64, setTuReceiptBase64] = useState("");
  const [tuReceiptMime, setTuReceiptMime] = useState("");
  const [tuReceiptFileName, setTuReceiptFileName] = useState("");
  const [tuStep, setTuStep] = useState(1); // T1: bosqichли to'ldirish
  const [tuVerifying, setTuVerifying] = useState(false);

  // Withdraw form
  const [wdPlatform, setWdPlatform] = useState(PLATFORMS[0]);
  const [wdCustomPlatform, setWdCustomPlatform] = useState("");
  const [wdAccountId, setWdAccountId] = useState("");
  const [wdCode, setWdCode] = useState("");
  const [wdAmount, setWdAmount] = useState("");
  const [wdMethod, setWdMethod] = useState<PaymentMethod>("click");
  const [wdPayoutDetails, setWdPayoutDetails] = useState("");
  const [wdRecipientName, setWdRecipientName] = useState("");

  const [successLabel, setSuccessLabel] = useState("");
  // Buyurtma yaratildi, lekin chek yuklanmadi kabi qisman-xato holati —
  // umumiy `error`dan ajratilgan, shunda success ekranida ko'rsatiladi va
  // boshqa ekranlarga sizib o'tmaydi. (F4-01)
  const [successWarning, setSuccessWarning] = useState<string | null>(null);
  // Auth ekranidagi ijobiy/info xabar (yashil) — masalan "Parol yangilandi".
  // Umumiy `error` (qizil) bilan aralashmasligi uchun alohida. (F4-07)
  const [authInfo, setAuthInfo] = useState("");

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState<"all" | "pending" | "completed" | "rejected">("all");

  // Support
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportText, setSupportText] = useState("");
  const [supportReplyTo, setSupportReplyTo] = useState<SupportMessage | null>(null);
  // F1c: qaysi failed xabar uchun retry/edit menyusи ochiq (clientId).
  const [failedMenuFor, setFailedMenuFor] = useState<string | null>(null);
  // F2: rasm composer draft (preview'да, hali yuborilmagan) va caption.
  const [imageDraft, setImageDraft] = useState<{ previewUrl: string; imageBase64: string; mimeType: string; fileName: string } | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  // F2: klaviatura ochilgandagi barqaror viewport balandligi (px).
  const [supportViewportH, setSupportViewportH] = useState<number | null>(null);
  // F2b: to'liq ekran rasm (BackButton uni yopadi, menyuga chiqmaydi).
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  // F2b: "Nusxalandi" bildirishnomasi (long-press copy).
  const [copiedToast, setCopiedToast] = useState(false);
  // F2b: biriktirilgan buyurtma kartasi ag'darilganmi (old=buyurtma, orqa=sabab).
  const [orderCardFlipped, setOrderCardFlipped] = useState(false);
  // Part I: pastga qaytish tugmasi (faqat tepaga scroll qilinganda ko'rinadi).
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Part I: long-press ochgan xabar menyusi (id) — Nusxalash / O'chirish.
  const [msgMenuFor, setMsgMenuFor] = useState<SupportMessage | null>(null);
  const [msgMenuPos, setMsgMenuPos] = useState<{ x: number; y: number } | null>(null);
  // Menyu ochilgach barmoq ko'tarilishi tugmani avto-bosmasligi uchun ~280ms
  // "qurollangan" bo'lmaydi (auto-nusxalash muammosini oldini oladi).
  const [menuArmed, setMenuArmed] = useState(false);
  const [myChatTheme, setMyChatTheme] = useState("blue");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  // Yuqoriga scroll qilib eski tarixni yuklash (oxirgi 50 dan tashqarisi).
  const [supportHasMore, setSupportHasMore] = useState(true);
  const [supportLoadingMore, setSupportLoadingMore] = useState(false);
  // __END_CONFIRM__ kartasi: qaysi xabar (id) hozir yuborilmoqda (tugmalarni
  // vaqtincha o'chirish + spinner) va qaysilariga javob allaqachon berilgan
  // (Ha/Yo'q qayta bosib bo'lmaydi — server bu holatni saqlamaydi, shuning
  // uchun mahalliy Set 4s poll davomida ham saqlanib qoladi).
  const [endConfirmSendingId, setEndConfirmSendingId] = useState<string | null>(null);
  const [respondedEndConfirmIds, setRespondedEndConfirmIds] = useState<{ [id: string]: boolean }>({});
  // Support ekraniga xos xato (rasm/ovoz) — umumiy `error`dan ajratilgan,
  // shunda support ekranida ko'rsatiladi va boshqa ekranlarga sizmaydi.
  const [supportError, setSupportError] = useState("");
  const supportBottomRef = useRef<HTMLDivElement>(null);
  const supportListRef = useRef<HTMLDivElement>(null);
  // Xabarlar haqiqatan o'zgarganini yengil aniqlash uchun imzo (soni + oxirgi
  // xabar id + created_at) — o'zgarmasa state yangilanmaydi.
  const supportSigRef = useRef<string>("");
  // Support ekrani ochilgandagi birinchi scroll animatsiyasiz bo'lsin.
  const supportFirstScrollRef = useRef(true);
  // Yangi xabar DOM'ga qo'shilishidan OLDINGI holatni saqlaydi — aks holda
  // scrollHeight'dan masofani xabar qo'shilgandan KEYIN o'lchash yangi
  // xabarning o'zi balandligicha xato beradi (pastda turgan bo'lsa ham
  // "tepada" deb hisoblanib, avto-scroll bekor qilinardi).
  const supportNearBottomRef = useRef(true);
  // F1: optimistik xabarларга noyob vaqtинча id berish uchun.
  const optimisticSeqRef = useRef(0);
  // F1b: sinxron dedup guard (bir xil xabar ikki marta ketmasin) va
  // fire-and-forget yetkazishlarning AbortControllerlari (unmount'да bekor).
  const sendLockRef = useRef(false);
  const inflightRef = useRef<Set<AbortController>>(new Set());
  // F2: matn input'iga fokusni saqlash uchun (Send'да klaviatura yopilmasin).
  const supportInputRef = useRef<HTMLInputElement>(null);
  const voiceRecorder = useVoiceRecorder();

  const getInitData = () => window.Telegram?.WebApp?.initData ?? "";

  // Hamkorlik arizasi (lead)
  const [plCompany, setPlCompany] = useState("");
  const [plMessage, setPlMessage] = useState("");
  const [plSubmitting, setPlSubmitting] = useState(false);
  const [plDone, setPlDone] = useState(false);
  const [plError, setPlError] = useState("");
  // Hamkor app'i bo'lsa (partner boti orqali ochilgan) — partnerId to'ldiriladi.
  const [partnerId, setPartnerId] = useState<string | null>(null);
  // "Allaqachon hamkormisiz?" — email orqali parol havolasi
  const [pmEmail, setPmEmail] = useState("");
  const [pmBusy, setPmBusy] = useState(false);
  const [pmSent, setPmSent] = useState(false);
  const [pmError, setPmError] = useState("");
  const [pmOpen, setPmOpen] = useState(false);

  const requestPartnerInvite = async () => {
    setPmError("");
    if (!pmEmail.trim()) { setPmError("Emailingizni kiriting."); return; }
    setPmBusy(true);
    try {
      const res = await fetch("/api/partner/request-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pmEmail.trim() }),
      });
      if (!res.ok) {
        setPmError(res.status === 429 ? t("tg.eTooMany2") : t("tg.eGeneric2"));
        return;
      }
      // Javob har doim neytral — email hamkorники bo'lsa, havola emailiga yuboriladi.
      setPmSent(true);
    } catch {
      setPmError("Ulanishda xatolik.");
    } finally {
      setPmBusy(false);
    }
  };

  const submitPartnerLead = async () => {
    setPlError("");
    setPlSubmitting(true);
    try {
      const res = await fetch("/api/telegram/miniapp/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(),
          name: customer?.full_name ?? "",
          phone: customer?.phone ?? "",
          company: plCompany.trim(),
          message: plMessage.trim(),
        }),
      });
      if (!res.ok) { setPlError("Yuborishda xatolik. Qayta urinib ko'ring."); return; }
      setPlDone(true);
    } catch {
      setPlError("Ulanishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setPlSubmitting(false);
    }
  };

  useEffect(() => {
    fetch("/api/telegram/miniapp/branding")
      .then((r) => r.json())
      .then((data) => { setLogoUrl(data.logoUrl); if (data.logoPosition) setLogoPos(data.logoPosition); })
      .catch(() => {});
  }, []);

  // F2: keyboard ochilganda chat sakramasin/kichraymasin — ko'rinadigan
  // (visible) balandlikni kuzatib, support ekranini shu balandlikка moslaymiz.
  // Telegram WebApp `viewportChanged` + brauzer `visualViewport` birga.
  useEffect(() => {
    const apply = () => {
      const tg = (window as any)?.Telegram?.WebApp;
      const vv = (window as any).visualViewport;
      const h = vv?.height || tg?.viewportHeight || window.innerHeight;
      setSupportViewportH(h ? Math.round(h) : null);
    };
    apply();
    const vv = (window as any).visualViewport;
    vv?.addEventListener?.("resize", apply);
    vv?.addEventListener?.("scroll", apply);
    const tg = (window as any)?.Telegram?.WebApp;
    tg?.onEvent?.("viewportChanged", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv?.removeEventListener?.("resize", apply);
      vv?.removeEventListener?.("scroll", apply);
      tg?.offEvent?.("viewportChanged", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = async () => {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
      // F2: mini app'ni pastga surib yopishни o'chirамиз — chat barqaror qoladi.
      (window as any)?.Telegram?.WebApp?.disableVerticalSwipes?.();
      const initData = getInitData();
      if (!initData) {
        setError(t("tg.eTgOnly"));
        setScreen("auth");
        return;
      }
      // W1.1: payment-info endi mustaqil oldindan yuklanmaydi — rekvizit
      // faqat buyurtma yaratilganda (POST /orders javobida) keladi.
      try {
        const res = await fetch("/api/telegram/miniapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = await res.json();
        setPartnerId(data.partnerId ?? null);
        applyAppTheme(data.theme);
        if (data.denied) {
          // Begona mijoz: bu bot uning "uyi" emas — bloklaymiz (neytral xabar).
          setScreen("blocked");
        } else if (data.registered) {
          setCustomer(data.customer);
          setScreen("menu");
        } else {
          setScreen("auth");
        }
      } catch {
        setError(t("tg.eConn"));
        setScreen("auth");
      }
    };
    document.body.appendChild(script);
  }, []);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAuthInfo("");
    if (!phone.trim() || !password.trim()) {
      setError(t("tg.eNeedPhonePass"));
      return;
    }
    // Ro'yxatda haqiqiy ism-familiya (kamida 2 so'z) majburiy.
    if (mode === "register" && fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
      setError(t("tg.eNameRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = mode === "register" ? "/api/telegram/miniapp/register" : "/api/telegram/miniapp/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), phone: phone.trim(), password, fullName: mode === "register" ? fullName.trim() : fullName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          phone_taken: t("tg.ePhoneTaken"),
          telegram_already_linked: t("tg.eTgLinked"),
          weak_password: t("tg.eWeakPass"),
          name_required: t("tg.eNameRequired"),
          not_found: t("tg.eNotFound"),
          wrong_password: t("tg.eWrongPass"),
          linked_to_other_telegram: t("tg.eLinkedOther"),
          rate_limited: t("tg.errRate"),
        };
        setError(messages[data.error] ?? "Xatolik yuz berdi.");
        return;
      }
      setCustomer(data.customer);
      setScreen("menu");
    } catch {
      setError(t("tg.eConn"));
    } finally {
      setSubmitting(false);
    }
  };

  const requestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    setFpInfo("");
    if (!fpPhone.trim()) {
      setFpError("Telefon raqamini kiriting.");
      return;
    }
    setFpSubmitting(true);
    try {
      const res = await fetch("/api/telegram/miniapp/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), phone: fpPhone.trim() }),
      });
      if (!res.ok) throw new Error();
      setFpInfo("Agar bu raqam ro'yxatdan o'tgan va Telegram bilan bog'langan bo'lsa, tasdiqlash kodi yuborildi.");
      setFpStep("code");
    } catch {
      setFpError("Ulanishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setFpSubmitting(false);
    }
  };

  const confirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    if (!fpCode.trim() || fpNewPassword.length < 6) {
      setFpError(t("tg.fpNeedCode"));
      return;
    }
    setFpSubmitting(true);
    try {
      const res = await fetch("/api/telegram/miniapp/forgot-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), phone: fpPhone.trim(), code: fpCode.trim(), newPassword: fpNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          invalid_code: t("tg.eInvalidCode"),
          code_expired: t("tg.eCodeExpired"),
          weak_password: t("tg.eWeakPass"),
          rate_limited: t("tg.errRate"),
        };
        setFpError(messages[data.error] ?? "Xatolik yuz berdi.");
        return;
      }
      setPhone(fpPhone.trim());
      setPassword("");
      setFpStep("phone");
      setFpPhone(""); setFpCode(""); setFpNewPassword(""); setFpInfo(""); setFpError("");
      setMode("login");
      setError("");
      setAuthInfo("Parol yangilandi — endi yangi parolingiz bilan kiring.");
      setScreen("auth");
    } catch {
      setFpError("Ulanishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setFpSubmitting(false);
    }
  };

  const resetForms = () => {
    setTuAccountId(""); setTuAmount(""); setTuPlatform(PLATFORMS[0]); setTuCustomPlatform(""); setTuMethod("click");
    setTuOrderId(null); setTuRequisite(null); setTuNeedsFullName(false); setTuFullNameInput("");
    setTuReceiptBase64(""); setTuReceiptMime(""); setTuReceiptFileName(""); setTuStep(1);
    setWdAccountId(""); setWdAmount(""); setWdCode(""); setWdPlatform(PLATFORMS[0]); setWdCustomPlatform(""); setWdMethod("click"); setWdPayoutDetails(""); setWdRecipientName("");
  };

  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(t("tg.eImgOnly"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("tg.eImg5MB"));
      return;
    }
    setError("");
    setTuReceiptFileName(file.name);
    setTuReceiptMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setTuReceiptBase64(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  };

  const verifyTopupId = async () => {
    setError("");
    const platform = tuPlatform === "Boshqa" ? tuCustomPlatform.trim() : tuPlatform;
    if (!platform || !tuAccountId.trim()) { setError(t("tg.ePlatformId")); return; }
    setTuVerifying(true);
    try {
      const res = await fetch("/api/telegram/miniapp/verify-player", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), accountId: tuAccountId.trim() }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setError(d.error === "not_found" ? t("tg.eIdNotFound2") : d.error === "not_configured" ? t("tg.eCdOff") : t("tg.eVerify"));
        return;
      }
      setTuStep(2);
    } finally {
      setTuVerifying(false);
    }
  };

  // W1.1: buyurtma endi shu yerda — 2-qadom (summa+usul) tugagach —
  // yaratiladi. Server rekvizitni o'zi tanlaydi va shu javobda qaytaradi;
  // mustaqil "oldindan ko'rish" endi yo'q (faqat MAVJUD buyurtma uchun
  // rekvizit bo'ladi).
  const createTopupOrder = async () => {
    setError("");
    const platform = tuPlatform === "Boshqa" ? tuCustomPlatform.trim() : tuPlatform;
    if (!platform || !tuAccountId.trim() || !tuAmount || Number(tuAmount) <= 0) {
      setError(t("tg.eAllFields"));
      return;
    }
    setTuCreatingOrder(true);
    try {
      const res = await fetch("/api/telegram/miniapp/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), type: "topup", platform, accountId: tuAccountId.trim(),
          amount: Number(tuAmount), paymentMethod: tuMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "player_not_found") {
          setError(t("tg.eIdNotFound"));
        } else if (data.error === "order_limit_exceeded") {
          setError(`Bitta buyurtma uchun maksimal summa: ${Number(data.limit).toLocaleString("ru-RU")} so'm.`);
        } else if (data.error === "daily_limit_exceeded") {
          setError(`Kunlik limitga yetdingiz (${Number(data.limit).toLocaleString("ru-RU")} so'm). Ertaga qayta urinib ko'ring yoki operator bilan bog'laning.`);
        } else if (data.error === "too_many_pending_orders") {
          setError(t("tg.ePendingOrders"));
        } else if (data.error === "topup_disabled") {
          setError(t("tg.eTopupOff"));
        } else if (data.error === "no_payment_method_available") {
          setError(t("tg.noMethodInfo"));
        } else if (data.error === "temporarily_blocked") {
          setError(t("tg.eBlocked"));
        } else if (data.error === "full_name_required") {
          setTuNeedsFullName(true);
        } else if (data.error === "name_mismatch") {
          setError(t("tg.eNameMismatch"));
        } else {
          setError(t("tg.eOrderSend"));
        }
        return;
      }
      setTuOrderId(data.order.id);
      setTuRequisite(data.requisite ?? null);
      setTuStep(3);
    } catch {
      setError(t("tg.eOrderSend"));
    } finally {
      setTuCreatingOrder(false);
    }
  };

  // W1.4: bir martalik ism kiritish (full_name bo'sh mijoz uchun) —
  // yuborilgach, buyurtma yaratish avtomatik qayta urinadi.
  const submitFullNameAndRetry = async () => {
    if (!tuFullNameInput.trim()) {
      setError(t("tg.eNameRequired"));
      return;
    }
    setTuSavingFullName(true);
    setError("");
    try {
      const res = await fetch("/api/telegram/miniapp/set-full-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), fullName: tuFullNameInput.trim() }),
      });
      if (!res.ok) {
        setError(t("tg.eOrderSend"));
        return;
      }
      setTuNeedsFullName(false);
      await createTopupOrder();
    } catch {
      setError(t("tg.eOrderSend"));
    } finally {
      setTuSavingFullName(false);
    }
  };

  const submitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessWarning(null);
    if (!tuOrderId) {
      setError(t("tg.eOrderSend"));
      return;
    }
    if (!tuReceiptBase64) {
      setError(t("tg.eReceipt"));
      return;
    }
    setSubmitting(true);
    try {
      const receiptRes = await fetch("/api/telegram/miniapp/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), orderId: tuOrderId, imageBase64: tuReceiptBase64, mimeType: tuReceiptMime,
        }),
      });
      if (!receiptRes.ok) {
        setSuccessWarning(t("tg.wReceipt"));
      }

      setSuccessLabel(t("tg.topupTitle"));
      resetForms();
      setScreen("order-success");
    } catch {
      setError(t("tg.eOrderSend"));
    } finally {
      setSubmitting(false);
    }
  };

  // Resets the local session view. Since this app auto-signs the customer
  // back in by their Telegram identity (see the session route), reopening
  // the mini app will log them back in automatically — this just clears
  // the current screen/state, useful on a shared device.
  const logout = () => {
    setCustomer(null);
    setError("");
    setScreen("auth");
  };

  const openOrders = async () => {
    setScreen("orders");
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/telegram/miniapp/orders?initData=${encodeURIComponent(getInitData())}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  // S1: real-time holat — buyurtмалар ekрани ochiq bo'lса jim yangilanadi.
  // Faqat MUVAFFAQIYATLI va to'g'ri shakldagi javob kelganda almashtiramiz —
  // aks holda (xato javob, kutilmagan shakl) eski ro'yxat ekranda qoladi va
  // shartli render qilinadigan tugmalar bir lahzaga yo'qolib ketmaydi.
  const refreshOrders = async () => {
    try {
      const res = await fetch(`/api/telegram/miniapp/orders?initData=${encodeURIComponent(getInitData())}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.orders)) setOrders(data.orders);
    } catch {
      /* jim */
    }
  };
  useEffect(() => {
    if (screen !== "orders") return;
    const t = setInterval(refreshOrders, 5000);
    return () => clearInterval(t);
  }, [screen]);

  const loadSupport = async (silent = false) => {
    if (!silent) setSupportLoading(true);
    try {
      const res = await fetch(`/api/telegram/miniapp/support?initData=${encodeURIComponent(getInitData())}`);
      const data = await res.json();
      const msgs: SupportMessage[] = data.messages ?? [];
      setSupportHasMore(!!data.hasMore);
      // F1 merge-reconcile: hali serverда yo'q optimistik (sending/failed)
      // xabarlarni saqlab qolamiz, aks holda 4s poll ularni o'chirib yuboradi.
      // Server versiyasi (real id) paydo bo'lса, optimistik nusxa tushib qoladi
      // (dublikat bo'lmaydi). Imzoga pending holati ham kiritiladi —
      // o'zgarmasa idle render bo'lmaydi. (Imzo yangilash prod build'да xavfsiz;
      // StrictMode dev double-invoke'да ham natija bir xil idempotent bo'ladi.)
      setSupportMessages((prev) => {
        const serverIds = new Set(msgs.map((m) => m.id));
        const pending = prev.filter(
          (m) =>
            m.clientId &&
            (m.status === "sending" || m.status === "failed") &&
            !serverIds.has(m.id) &&
            !msgs.some((s) => optimisticMatchesServer(m, s))
        );
        // F3: endpoint endi FAQAT oxirgi 50 tani qaytaradi (chat darhol
        // ochilishi uchun) — yuqoriga scroll qilib oldin yuklangan, shu
        // javobda yo'q (eskiroq) xabarlarni saqlab qolamiz.
        const earliestNewTs = msgs.length ? new Date(msgs[0].created_at).getTime() : Infinity;
        const olderPreserved = prev.filter(
          (m) => !m.clientId && !serverIds.has(m.id) && new Date(m.created_at).getTime() < earliestNewTs
        );
        const merged = [...olderPreserved, ...msgs];
        const last = msgs[msgs.length - 1];
        const sig = `${merged.length}:${last?.id ?? ""}:${last?.created_at ?? ""}|${pending
          .map((p) => `${p.clientId}:${p.status}`)
          .join(",")}`;
        if (sig === supportSigRef.current) return prev;
        supportSigRef.current = sig;
        return pending.length ? [...merged, ...pending] : merged;
      });
    } catch {
      if (!silent) {
        supportSigRef.current = "";
        // Xatoда server qismini bo'shatamiz, optimistik pendingni saqlaymiz.
        setSupportMessages((prev) =>
          prev.filter((m) => m.clientId && (m.status === "sending" || m.status === "failed"))
        );
      }
    } finally {
      if (!silent) setSupportLoading(false);
    }
  };

  // F3: chat tepasiga scroll qilinganda oldingi (50 tadan eski) xabarlarni
  // yuklaydi. Kontent tepaga qo'shilgandagi vizual "sakrash"ni oldini olish
  // uchun eski scrollHeight bilan yangisi orasidagi farqga scrollTop
  // qo'lda moslashtiriladi.
  const loadMoreSupport = async () => {
    if (supportLoadingMore || !supportHasMore || supportMessages.length === 0) return;
    const list = supportListRef.current;
    const prevScrollHeight = list?.scrollHeight ?? 0;
    setSupportLoadingMore(true);
    try {
      const oldest = supportMessages[0];
      const res = await fetch(
        `/api/telegram/miniapp/support?initData=${encodeURIComponent(getInitData())}&before=${encodeURIComponent(oldest.created_at)}`
      );
      const data = await res.json();
      const older: SupportMessage[] = data.messages ?? [];
      setSupportHasMore(!!data.hasMore);
      if (older.length > 0) {
        setSupportMessages((prev) => [...older, ...prev]);
        requestAnimationFrame(() => {
          const el = supportListRef.current;
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      }
    } catch {
      /* jim */
    } finally {
      setSupportLoadingMore(false);
    }
  };

  const openSupport = async (orderId: string | null = null) => {
    setScreen("support");
    setSelectedOrderId(orderId);
    setSupportError("");
    // Har ochilishda eski javob-nishoni va tema-tanlagichni tozalaymiz, aks
    // holda javob banneri noto'g'ri kontekstda qolib ketadi.
    setSupportReplyTo(null);
    setShowThemePicker(false);
    setOrderCardFlipped(false);
    // Har ochilishda birinchi scroll instant bo'lsin; imzoni tozalab, keyingi
    // loadSupport xabarlarni qayta o'rnatib pastga surishini ta'minlaymiz.
    supportFirstScrollRef.current = true;
    supportSigRef.current = "";
    setSupportHasMore(true);
    // Buyurtma tanlash uchun mijozning buyurtmalarini yuklaymiz — bu xabarlar
    // ko'rinishini KUTIB TURMAYDI (parallel, fon rejimida), aks holda chat
    // ekrani bitta qo'shimcha tarmoq safaridan keyin ochilardi.
    fetch(`/api/telegram/miniapp/orders?initData=${encodeURIComponent(getInitData())}`)
      .then((r) => r.json())
      .then((ordData) => setOrders(ordData.orders ?? []))
      .catch(() => {});
    // Mijoz 5 daqiqadan ko'p tashqarida bo'lgan bo'lsa — eski suhbatni tozalaymiz.
    try {
      const leftRaw = localStorage.getItem("supportLeftAt");
      if (leftRaw && Date.now() - Number(leftRaw) > 5 * 60 * 1000) {
        await fetch("/api/telegram/miniapp/support/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: getInitData() }),
        }).catch(() => {});
      }
      localStorage.removeItem("supportLeftAt");
    } catch {}
    await loadSupport();
    // F2b: buyurtma orqali kirilganda klaviatura darhol ochiladi (avto-reply).
    if (orderId) setTimeout(() => supportInputRef.current?.focus(), 150);
    fetch(`/api/telegram/miniapp/theme?initData=${encodeURIComponent(getInitData())}`)
      .then((r) => r.json())
      .then((data) => { if (data.theme) setMyChatTheme(data.theme); })
      .catch(() => {});
  };

  // Pastki nav tabi. "Yordam" va "Buyurtma" oddiy setScreen bilan ochilsa,
  // ochish mantiqi (buyurtmalarni yuklash, eski suhbatni tozalash, scroll
  // imzosini tiklash) chetlab o'tiladi — shuning uchun o'z ochuvchilariga
  // yo'naltiramiz. Yangi ekran/sahifa yaratilmaydi.
  const navigateTab = (s: string) => {
    if (s === "support") { void openSupport(null); return; }
    if (s === "orders") { void openOrders(); return; }
    setScreen(s as any);
  };

  useEffect(() => {
    if (screen !== "support") return;
    const interval = setInterval(() => loadSupport(true), 4000);
    return () => clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    if (screen !== "support") return;
    const bottom = supportBottomRef.current;
    if (!bottom) return;
    // Birinchi ochilishda darhol (animatsiyasiz) pastga tush — LEKIN bayroqni
    // faqat haqiqiy xabarlar render bo'lgach iste'mol qilamiz, aks holda u
    // bo'sh/yuklanayotgan ro'yxatda sarflanib, chat tepada qolib ketadi.
    if (supportFirstScrollRef.current) {
      if (supportLoading || supportMessages.length === 0) return;
      supportFirstScrollRef.current = false;
      bottom.scrollIntoView({ behavior: "auto" });
      return;
    }
    // Keyingi yangi xabarlarda: faqat foydalanuvchi allaqachon pastga yaqin
    // bo'lsa sur (tepada eski xabarlarni o'qiyotgan bo'lsa uzmaymiz).
    // supportNearBottomRef — xabar qo'shilishidan OLDINGI holat (onScroll
    // orqali yangilanadi), shuning uchun yangi xabarning o'z balandligi
    // hisobga aralashib, noto'g'ri "tepada" degan xulosaga olib kelmaydi.
    if (!supportNearBottomRef.current) return;
    bottom.scrollIntoView({ behavior: "smooth" });
  }, [supportMessages, screen]);

  // F2b: klaviatura ochilganda (viewport o'zgarsa) oxirgi xabarga tushiramiz.
  useEffect(() => {
    if (screen !== "support" || supportViewportH == null) return;
    supportBottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [supportViewportH, screen]);

  // Chatdan chiqilganda faqat VAQTNI belgilaymiz (darhol tozalamaymiz).
  // Suhbat operator/mijoz yakunlaguncha saqlanadi; agar mijoz chiqib ketib
  // 5 daqiqadan ko'p qaytmasa -> keyingi kirishda tozalanadi (openSupport).
  useEffect(() => {
    if (screen !== "support") return;
    return () => {
      try { localStorage.setItem("supportLeftAt", String(Date.now())); } catch {}
    };
  }, [screen]);

  const confirmEnd = async (messageId: string, resolved: boolean) => {
    if (endConfirmSendingId) return; // sinxron dedup — ikkinchi bosishni e'tiborsiz qoldiradi
    setEndConfirmSendingId(messageId);
    try {
      await fetch("/api/telegram/miniapp/support/end-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), resolved }),
      });
      setRespondedEndConfirmIds((prev) => ({ ...prev, [messageId]: resolved }));
      await loadSupport(true);
    } catch {} finally {
      setEndConfirmSendingId(null);
    }
  };

  // F1: optimistik xabarning holatini clientId bo'yicha yangilaydi.
  const setMsgStatus = (clientId: string, status: "sending" | "sent" | "failed") => {
    setSupportMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status } : m)));
  };

  // F1b: fire-and-forget yetkazish. Optimistik xabarni serverga yuboradi,
  // 12s AbortController timeout bilan; natijaga qarab clientId holatini
  // "sent"/"failed" qiladi. Composer buni KUTMAYDI — Send darhol qayta ishlaydi.
  const deliverSupportMessage = async (
    clientId: string,
    payload: { message: string; replyToId: string | null; orderId: string | null }
  ) => {
    const controller = new AbortController();
    inflightRef.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/telegram/miniapp/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), message: payload.message, replyToId: payload.replyToId, orderId: payload.orderId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setMsgStatus(clientId, "failed");
        const data = await res.json().catch(() => ({}));
        setSupportError(supportSendErrorMessage(t, (data as any)?.error, res.status, "message"));
        return;
      }
      // Muvaffaqiyat: optimistik nusxани server id + "sent" ga reconcile.
      // clientId olib tashlanadi — keyingi poll merge dublikat yaratmaydi.
      const data = await res.json().catch(() => ({}));
      const serverId = (data as any)?.message?.id;
      setSupportMessages((prev) =>
        prev.map((m) =>
          m.clientId === clientId ? { ...m, id: serverId ?? m.id, clientId: undefined, status: "sent" } : m
        )
      );
    } catch {
      // AbortController timeout yoki tarmoq xatosi → failed. navigator.onLine
      // faqat xabar matnini aniqlashtiradi (asosiy mezon — fetch/abort natijasi).
      setMsgStatus(clientId, "failed");
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setSupportError(
        offline
          ? t("tg.eOffline")
          : t("tg.errMsgSend")
      );
    } finally {
      clearTimeout(timer);
      inflightRef.current.delete(controller);
    }
  };

  // F1b: sinxron (async EMAS) — composer serverni KUTMAYDI (fire-and-forget).
  const sendSupportMessage = () => {
    if (sendLockRef.current) return; // sinxron dedup (Enter-repeat / ikki tap)
    const text = supportText.trim();
    if (!text) return;
    sendLockRef.current = true;
    setTimeout(() => { sendLockRef.current = false; }, 0);

    const replyToId = supportReplyTo?.id ?? null;
    const orderId = selectedOrderId;
    const clientId = `tmp-${Date.now()}-${optimisticSeqRef.current++}`;
    // Optimistik: xabar darhol bubble sifatida ko'rinadi, composer darhol
    // tozalanadi. Yetkazish orqada ishlaydi; xato bo'lса bubble "failed".
    const optimistic: SupportMessage = {
      id: clientId, clientId, status: "sending",
      sender: "customer", message: text,
      image_path: null, file_name: null, voice_path: null, voice_duration_seconds: null,
      reply_to_id: replyToId, created_at: new Date().toISOString(),
      order_id: orderId,
      _draft: { kind: "text", message: text, replyToId, orderId },
    };
    setSupportMessages((prev) => [...prev, optimistic]);
    setSupportText("");
    setSupportReplyTo(null);
    setSupportError("");
    // F2e: karta xabar bilan "ketdi" — composer ustidan olib tashlanadi.
    setSelectedOrderId(null);
    void deliverSupportMessage(clientId, { message: text, replyToId, orderId });
    // F2: input fokusда qolsin — klaviatura yopilmasin (ketma-ket yozish).
    supportInputRef.current?.focus();
  };

  // F1b: sahifa yopilganda (unmount) in-flight yetkazishlarni bekor qilamiz.
  useEffect(() => {
    const inflight = inflightRef.current;
    return () => { inflight.forEach((c) => c.abort()); inflight.clear(); };
  }, []);

  // F2b: BackButton uchun ochiq overlay yopuvchisini sinxronlaymiz —
  // to'liq rasm avvalroq, so'ng rasm preview composer.
  useEffect(() => {
    overlayCloserRef.current = fullscreenImage
      ? () => setFullscreenImage(null)
      : imageDraft
      ? () => { URL.revokeObjectURL(imageDraft.previewUrl); setImageDraft(null); setImageCaption(""); }
      : null;
  }, [fullscreenImage, imageDraft]);

  // F2b: long-press orqali xabar matnini nusxalash.
  const copyMessageText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: eski usul (clipboard API bo'lmasa).
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      } catch {}
    }
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 1400);
  };

  // F2b: bubble'ni bosib-ushlab (long-press ~450ms) nusxalash. Scroll/siljish
  // bo'lsa bekor bo'ladi. Matnни brauzer belgilashini oldini olish uchun
  // bubble'ga select-none qo'yiladi.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const cancelLongPress = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    longPressStartRef.current = null;
  };
  const openMsgMenu = (m: SupportMessage, pos: { x: number; y: number }) => {
    setMsgMenuFor(m);
    setMsgMenuPos(pos);
    setMenuArmed(false);
    setTimeout(() => setMenuArmed(true), 280);
  };

  // Xabar gesture'lari: long-press -> menyu (faqat matn xabar), yon-surish -> javob.
  const gestureRef = useRef<{ x: number; y: number; lp: ReturnType<typeof setTimeout> | null; swiped: boolean; captured: boolean } | null>(null);
  const bindMessageGestures = (m: SupportMessage, allowMenu: boolean) => ({
    onPointerDown: (e: React.PointerEvent) => {
      const pos = { x: e.clientX, y: e.clientY };
      const lp = allowMenu ? setTimeout(() => { openMsgMenu(m, pos); if (gestureRef.current) gestureRef.current.lp = null; }, 450) : null;
      gestureRef.current = { x: e.clientX, y: e.clientY, lp, swiped: false, captured: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if ((Math.abs(dx) > 8 || Math.abs(dy) > 8) && g.lp) { clearTimeout(g.lp); g.lp = null; }
      // Gorizontal niyat aniq bo'lsa — pointerni ushlaymiz (vertikal scroll
      // buzilmasligi uchun faqat shu holatda), so'ng swipe-to-reply.
      if (!g.captured && Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.captured = true;
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
      }
      if (!g.swiped && g.captured && !m.message?.startsWith("__END_CONFIRM__") && Math.abs(dx) > 42) {
        g.swiped = true;
        setSupportReplyTo(m);
        setSupportError("");
      }
    },
    onPointerUp: () => { const g = gestureRef.current; if (g?.lp) clearTimeout(g.lp); gestureRef.current = null; },
    onPointerCancel: () => { const g = gestureRef.current; if (g?.lp) clearTimeout(g.lp); gestureRef.current = null; },
    onPointerLeave: () => { const g = gestureRef.current; if (g?.lp) clearTimeout(g.lp); gestureRef.current = null; },
  });

  // F1c: xato xabarni asl payload bilan qayta yuborish.
  const retrySupportMessage = (clientId: string) => {
    const msg = supportMessages.find((m) => m.clientId === clientId);
    if (!msg?._draft) return;
    setFailedMenuFor(null);
    setSupportError("");
    setMsgStatus(clientId, "sending");
    if (msg._draft.kind === "image") {
      void deliverImageMessage(clientId, msg._draft);
    } else {
      void deliverSupportMessage(clientId, { message: msg._draft.message, replyToId: msg._draft.replyToId, orderId: msg._draft.orderId });
    }
  };

  // F1c/F2: xato xabarni tahrirlash — matn/reply/order yoki rasm+caption
  // composer'ga qaytadi; failed bubble ro'yxatдан olib tashlanadi.
  const editSupportMessage = (clientId: string) => {
    const msg = supportMessages.find((m) => m.clientId === clientId);
    if (!msg?._draft) return;
    setFailedMenuFor(null);
    setSupportError("");
    if (msg._draft.kind === "image") {
      const d = msg._draft;
      setImageDraft({ previewUrl: `data:${d.mimeType};base64,${d.imageBase64}`, imageBase64: d.imageBase64, mimeType: d.mimeType, fileName: d.fileName });
      setImageCaption(d.caption ?? "");
    } else {
      const d = msg._draft;
      setSupportText(d.message);
      setSelectedOrderId(d.orderId);
      const quoted = d.replyToId ? supportMessages.find((x) => x.id === d.replyToId) ?? null : null;
      setSupportReplyTo(quoted);
    }
    setSupportMessages((prev) => prev.filter((m) => m.clientId !== clientId));
  };

  const deleteSupportMessage = async (id: string) => {
    if (!confirm("Xabarni o'chirishni tasdiqlaysizmi?")) return;
    await fetch("/api/telegram/miniapp/support/delete-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData(), messageId: id }),
    });
    await loadSupport(true);
  };

  const supportMessageById = (id: string | null) => (id ? supportMessages.find((m) => m.id === id) ?? null : null);

  const changeChatTheme = async (next: string) => {
    setMyChatTheme(next);
    setShowThemePicker(false);
    await fetch("/api/telegram/miniapp/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData(), theme: next }),
    });
  };

  // F2: rasm tanlanганда DARHOL yubormaydi — preview composer ochadi.
  const sendSupportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setSupportError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setSupportError("Faqat rasm fayli (PNG/JPEG/WEBP) yuklash mumkin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSupportError("Rasm hajmi 5MB dan oshmasligi kerak.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const imageBase64 = result.split(",")[1] ?? "";
      setImageDraft({ previewUrl: URL.createObjectURL(file), imageBase64, mimeType: file.type, fileName: file.name });
      setImageCaption("");
    };
    reader.readAsDataURL(file);
  };

  // F2: rasmni bekor qilish (preview'ni yopib, mahalliy URL'ni tozalash).
  const cancelImageDraft = () => {
    if (imageDraft) URL.revokeObjectURL(imageDraft.previewUrl);
    setImageDraft(null);
    setImageCaption("");
  };

  // F2: optimistik rasm bubble + fire-and-forget upload (12s timeout).
  const deliverImageMessage = async (
    clientId: string,
    imgDraft: { imageBase64: string; mimeType: string; fileName: string; caption: string | null }
  ) => {
    const controller = new AbortController();
    inflightRef.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/telegram/miniapp/support/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), imageBase64: imgDraft.imageBase64, mimeType: imgDraft.mimeType, fileName: imgDraft.fileName, caption: imgDraft.caption }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setMsgStatus(clientId, "failed");
        const data = await res.json().catch(() => ({}));
        setSupportError(supportSendErrorMessage(t, (data as any)?.error, res.status, "image"));
        return;
      }
      const data = await res.json().catch(() => ({}));
      const inserted = (data as any)?.message;
      setSupportMessages((prev) =>
        prev.map((m) =>
          m.clientId === clientId
            ? { ...m, id: inserted?.id ?? m.id, image_path: inserted?.image_path ?? m.image_path, message: inserted?.message ?? m.message, clientId: undefined, status: "sent" }
            : m
        )
      );
    } catch {
      setMsgStatus(clientId, "failed");
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setSupportError(offline ? "Internet yo'q. Rasm yuborilmadi — ulanish tiklangach qayta urinib ko'ring." : "Rasm yuborilmadi. Qayta urinib ko'ring.");
    } finally {
      clearTimeout(timer);
      inflightRef.current.delete(controller);
    }
  };

  // F2: preview'даги rasmni optimistik bubble bilan yuborish.
  const confirmSendImage = () => {
    if (!imageDraft) return;
    const draft = imageDraft;
    const caption = imageCaption.trim() || null;
    const clientId = `tmp-${Date.now()}-${optimisticSeqRef.current++}`;
    const optimistic: SupportMessage = {
      id: clientId, clientId, status: "sending",
      sender: "customer", message: caption,
      image_path: null, file_name: draft.fileName, voice_path: null, voice_duration_seconds: null,
      reply_to_id: null, created_at: new Date().toISOString(),
      _localImageUrl: draft.previewUrl,
      _draft: { kind: "image", imageBase64: draft.imageBase64, mimeType: draft.mimeType, fileName: draft.fileName, caption },
    };
    setSupportMessages((prev) => [...prev, optimistic]);
    setImageDraft(null);
    setImageCaption("");
    setSupportError("");
    void deliverImageMessage(clientId, { imageBase64: draft.imageBase64, mimeType: draft.mimeType, fileName: draft.fileName, caption });
  };

  const startVoiceRecording = async () => {
    setSupportError("");
    await voiceRecorder.start();
  };

  const cancelVoiceRecording = () => {
    voiceRecorder.cancel();
  };

  const stopAndSendVoice = async () => {
    const recorded = await voiceRecorder.stop();
    if (!recorded) { setSupportError("Ovoz yozib olinmadi. Mikrofonga ruxsat bering."); return; }
    if (recorded.durationSeconds < 1) { setSupportError("Ovozli xabar juda qisqa."); return; }
    setSupportSending(true);
    setSupportError("");
    try {
      const audioBase64 = await blobToBase64(recorded.blob);
      const res = await fetch("/api/telegram/miniapp/support/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), audioBase64, mimeType: recorded.mimeType, durationSeconds: recorded.durationSeconds }),
      });
      if (res.ok) { await loadSupport(true); return; }
      // Aniq sabab (diagnostika): qurilma formati / o'lcham / boshqa.
      const data = await res.json().catch(() => ({}));
      const err = (data as any)?.error;
      const map: Record<string, string> = {
        invalid_mime: t("tg.vInvalidMime"),
        invalid_audio: t("tg.vInvalidAudio"),
        invalid_audio_size: t("tg.vInvalidSize"),
        invalid_duration: t("tg.vInvalidDuration"),
        rate_limited: t("tg.errRate"),
        upload_failed: t("tg.vUpload"),
        insert_failed: t("tg.vInsert"),
      };
      setSupportError(map[err] ?? `Ovozli xabar yuborilmadi${err ? ` (${err})` : ""}. Qayta urinib ko'ring.`);
    } catch {
      setSupportError("Tarmoq xatosi. Ovozli xabar yuborilmadi.");
    } finally {
      setSupportSending(false);
    }
  };

  if (screen === "loading") {
    return (
      <div className={`${bgCls} flex items-center justify-center relative`}>
        <FloatingAmbience />
        <div className="relative z-10">
          <BrandedLoader />
        </div>
      </div>
    );
  }

  if (screen === "blocked") {
    return (
      <div className={`${bgCls} p-6 flex flex-col items-center justify-center text-center relative`}>
        <FloatingAmbience />
        <div className="relative z-10 flex flex-col items-center max-w-[320px]">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border m-divider flex items-center justify-center mb-5">
            <ShieldCheck size={30} className="text-[#93a5ba]" />
          </div>
          <h1 className="text-[18px] font-extrabold mb-2" style={titleShadow}>{t("tg.blockedTitle")}</h1>
          <p className="text-[13px] text-[#93a5ba] leading-relaxed">
            {t("tg.blockedText")}
          </p>
        </div>
      </div>
    );
  }

  if (screen === "auth") {
    return (
      <div className={`${bgCls} p-6 flex flex-col justify-center relative`}>
        <FloatingAmbience />
        <div className="absolute top-4 right-4 z-20 flex items-center rounded-lg bg-white/[0.08] p-0.5 text-[11px] font-semibold">
          {(["uz", "ru"] as const).map((lng) => (
            <button
              key={lng}
              onClick={() => setLocale(lng)}
              className={`px-2 py-1 rounded-md transition-colors ${locale === lng ? "bg-[#3D7FFF] text-white" : "text-[#93a5ba]"}`}
              aria-label={lng === "uz" ? "O'zbekcha" : "Русский"}
            >
              {lng === "uz" ? "UZ" : "RU"}
            </button>
          ))}
        </div>
        <div className="max-w-sm mx-auto w-full relative z-10">
          <div className="flex justify-center mb-2">
            {logoUrl ? (
              <img src={logoUrl} alt="BetCore Pay" className="w-40 h-40 object-contain drop-shadow-[0_8px_20px_rgba(61,127,255,0.4)]" style={{ objectPosition: `${logoPos.x}% ${logoPos.y}%` }} />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] flex items-center justify-center text-[28px] shadow-[7px_7px_18px_rgba(0,0,0,0.5),-4px_-4px_14px_rgba(120,180,255,0.2)]">
                ⬡
              </div>
            )}
          </div>

          {!logoUrl && (
            <h1 className="text-[30px] font-black text-center mb-1 bg-gradient-to-r from-[#7db8ff] via-white to-[#F4C76A] bg-clip-text text-transparent" style={titleShadow}>
              BetCore Pay
            </h1>
          )}
          <p className="text-[13px] text-[#93a5ba] text-center mb-7">
            {mode === "login" ? t("tg.loginSub") : t("tg.registerSub")}
          </p>

          <form onSubmit={submitAuth} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <input className={inputCls} placeholder={t("tg.phFullNameReq")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <p className="text-[11px] text-[#F4C76A] mt-1.5 leading-relaxed px-1">{t("tg.nameRequired")}</p>
              </div>
            )}
            <input className={inputCls} placeholder={t("tg.phPhone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <PasswordInput className={inputCls} placeholder={t("tg.phPassword")} value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-[12px] text-[#FF6B85] text-center">{error}</p>}
            {authInfo && <p className="text-[12px] text-[#4ADE80] text-center">{authInfo}</p>}

            <button type="submit" disabled={submitting} className={buttonCls}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? t("tg.login") : t("tg.register")}
            </button>
          </form>

          {mode === "login" && (
            <button
              onClick={() => { setFpStep("phone"); setFpPhone(phone); setFpError(""); setFpInfo(""); setScreen("forgot-password"); }}
              className="w-full text-center mt-3.5 text-[12px] text-[#7db8ff]/80"
            >
              {t("tg.forgot")}
            </button>
          )}

          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setAuthInfo(""); }}
            className="group relative w-full text-center mt-5 py-3 rounded-xl text-[13px] font-bold text-[#7db8ff] bg-[#3D7FFF]/[0.08] border border-[#3D7FFF]/30 overflow-hidden hover:text-white hover:bg-[#3D7FFF]/[0.16] hover:border-[#3D7FFF]/50 transition-all active:scale-[0.98]"
          >
            <span className="pointer-events-none absolute top-0 -left-full w-3/5 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: "loginShimmer 3s infinite" }} />
            <style>{`@keyframes loginShimmer { 0%{left:-100%} 60%,100%{left:200%} }`}</style>
            <span className="relative z-10">{mode === "login" ? t("tg.toRegister") : t("tg.toLogin")}</span>
          </button>
        </div>
      </div>
    );
  }

  if (screen === "forgot-password") {
    return (
      <div className={`${bgCls} p-6 flex flex-col justify-center relative`}>
        <FloatingAmbience />
        <div className="max-w-sm mx-auto w-full relative z-10">
          <ScreenHeader title={t("tg.fpTitle")} onBack={() => setScreen("auth")} />

          {fpStep === "phone" ? (
            <form onSubmit={requestResetCode} className="space-y-3.5">
              <p className="text-[13px] text-[#93a5ba] mb-1">
                {t("tg.fpHint")}
              </p>
              <input className={inputCls} placeholder={t("tg.phPhone")} value={fpPhone} onChange={(e) => setFpPhone(e.target.value)} inputMode="tel" />
              {fpError && <p className="text-[12px] text-[#FF6B85] text-center">{fpError}</p>}
              <button type="submit" disabled={fpSubmitting} className={buttonCls}>
                {fpSubmitting ? <Loader2 size={16} className="animate-spin" /> : t("tg.fpSend")}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmResetPassword} className="space-y-3.5">
              {fpInfo && <p className="text-[12px] text-[#4ADE80] text-center mb-1">{fpInfo}</p>}
              <input className={inputCls} placeholder={t("tg.phCode")} value={fpCode} onChange={(e) => setFpCode(e.target.value)} inputMode="numeric" />
              <PasswordInput className={inputCls} placeholder={t("tg.phNewPass")} value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)} />
              {fpError && <p className="text-[12px] text-[#FF6B85] text-center">{fpError}</p>}
              <button type="submit" disabled={fpSubmitting} className={buttonCls}>
                {fpSubmitting ? <Loader2 size={16} className="animate-spin" /> : t("tg.fpUpdate")}
              </button>
              <button
                type="button"
                onClick={() => { setFpStep("phone"); setFpError(""); setFpInfo(""); }}
                className="w-full text-center text-[12px] text-[#7db8ff]/80"
              >
                {t("tg.fpOther")}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (screen === "order-success") {
    return (
      <div className={`${bgCls} p-6 flex flex-col items-center justify-center text-center relative`}>
        <FloatingAmbience />
        <div className="relative z-10 flex flex-col items-center">
        <CheckCircle2 size={48} className="text-[#4ADE80] mb-4" />
        <p className="text-[16px] font-bold mb-1.5">{successLabel} {t("tg.okTitleSuffix")}</p>
        <p className="text-[13px] text-[#93a5ba] mb-6">{t("tg.okSub")}</p>
        {successWarning && (
          <p className="text-[12px] text-[#F4C76A] bg-[#F4C76A]/10 border border-[#F4C76A]/30 rounded-lg px-3 py-2 mb-5 max-w-[300px]">{successWarning}</p>
        )}
        <button onClick={() => setScreen("menu")} className={`${buttonCls} max-w-[220px]`}>{t("tg.backToMenu")}</button>
        </div>
      </div>
    );
  }

  if (screen === "hamkorlik") {
    return (
      <div className={`${bgCls} p-5 relative`}>
        <FloatingAmbience />
        <div className="relative z-10 pb-8">
          <ScreenHeader title={t("tg.hkTitle")} onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />

          {/* Hero */}
          <div className="flex flex-col items-center text-center mb-7" style={{ animation: "hkRise .5s ease both" }}>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#F4C76A] to-[#3D7FFF] flex items-center justify-center mb-4" style={{ animation: "hkFloat 3.4s ease-in-out infinite, hkGlow 4s ease-in-out infinite" }}>
              <Handshake size={36} className="text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]" />
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight mb-2" style={titleShadow}>{t("tg.hkHero")}</h1>
            <p className="text-[13px] text-[#93a5ba] max-w-[300px]">{t("tg.hkHeroSub")}</p>
          </div>

          {/* Ustunliklar */}
          <div className="grid grid-cols-2 gap-3 mb-7">
            {[
              { icon: Building2, t: t("tg.adv1t"), d: t("tg.adv1d"), c: "#3D7FFF" },
              { icon: Globe, t: t("tg.adv2t"), d: t("tg.adv2d"), c: "#4ADE80" },
              { icon: Users, t: t("tg.adv3t"), d: t("tg.adv3d"), c: "#7c3aed" },
              { icon: Wallet, t: t("tg.adv4t"), d: t("tg.adv4d"), c: "#F4C76A" },
              { icon: ShieldCheck, t: t("tg.adv5t"), d: t("tg.adv5d"), c: "#4ADE80" },
              { icon: Rocket, t: t("tg.adv6t"), d: t("tg.adv6d"), c: "#3D7FFF" },
            ].map((v, i) => (
              <div key={v.t} className={menuCardCls} style={{ animation: "hkRise .5s ease both", animationDelay: `${0.06 * i + 0.1}s` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]" style={{ background: `linear-gradient(135deg, ${v.c}, ${v.c}99)` }}>
                  <v.icon size={16} className="text-white" />
                </div>
                <div className="text-[12.5px] font-bold">{v.t}</div>
                <div className="text-[10.5px] text-[#93a5ba] mt-0.5">{v.d}</div>
              </div>
            ))}
          </div>

          {/* Qanday boshlanadi */}
          <h2 className="text-[15px] font-bold mb-3">{t("tg.hkHow")}</h2>
          <div className="space-y-2.5 mb-7">
            {[
              t("tg.step1"),
              t("tg.step2"),
              t("tg.step3"),
              t("tg.step4"),
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border m-divider px-3.5 py-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#3D7FFF] to-[#2456c9] flex items-center justify-center text-[13px] font-bold">{i + 1}</div>
                <div className="text-[13px]">{s}</div>
              </div>
            ))}
          </div>

          {/* Qoidalar */}
          <h2 className="text-[15px] font-bold mb-3">{t("tg.hkRules")}</h2>
          <div className="rounded-2xl bg-white/[0.04] border m-divider p-4 mb-7 space-y-2.5">
            {[
              t("tg.rule1"),
              t("tg.rule2"),
              t("tg.rule3"),
              t("tg.rule4"),
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px]">
                <CheckCircle2 size={16} className="text-[#4ADE80] shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
          </div>

          {/* Ariza formasi */}
          {plDone ? (
            <div className="rounded-2xl bg-[#4ADE80]/10 border border-[#4ADE80]/30 p-5 text-center" style={{ animation: "hkRise .4s ease both" }}>
              <CheckCircle2 size={40} className="text-[#4ADE80] mx-auto mb-3" />
              <div className="text-[15px] font-bold mb-1">{t("tg.hkDone")}</div>
              <div className="text-[12px] text-[#93a5ba]">{t("tg.hkDoneSub")}</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.04] border m-divider p-4">
              <div className="text-[14px] font-bold mb-3 flex items-center gap-1.5"><Handshake size={16} className="text-[#F4C76A]" /> {t("tg.hkForm")}</div>
              <input
                value={plCompany}
                onChange={(e) => setPlCompany(e.target.value)}
                placeholder={t("tg.phCompany")}
                className="w-full bg-white/5 border m-divider rounded-lg py-2.5 px-3 text-[13px] outline-none focus:border-[#3D7FFF] mb-2.5"
              />
              <textarea
                value={plMessage}
                onChange={(e) => setPlMessage(e.target.value)}
                rows={3}
                placeholder={t("tg.phAbout")}
                className="w-full bg-white/5 border m-divider rounded-lg py-2.5 px-3 text-[13px] outline-none focus:border-[#3D7FFF] mb-2.5 resize-none"
              />
              <p className="text-[11px] text-[#93a5ba] mb-3">{t("tg.hkAuto")} <span className="text-white/80">{customer?.full_name || customer?.phone || "—"}</span></p>
              {plError && <p className="text-[12px] text-[#FF6B85] mb-2.5">{plError}</p>}
              <button onClick={submitPartnerLead} disabled={plSubmitting} className={buttonCls} style={{ animation: "hkGlow 4s ease-in-out infinite" }}>
                <span className="flex items-center justify-center gap-2">
                  {plSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Rocket size={17} /> {t("tg.hkSubmit")}</>}
                </span>
              </button>
            </div>
          )}

          {/* Allaqachon hamkormisiz? — email orqali parol havolasi */}
          <div className="mt-6 text-center">
            <button onClick={() => setPmOpen((v) => !v)} className="text-[12px] text-[#93a5ba] underline">{t("tg.hkAlready")}</button>
            {pmOpen && (
              <div className="mt-3 rounded-2xl bg-white/[0.04] border m-divider p-4 text-left">
                {pmSent ? (
                  <div className="text-center" style={{ animation: "hkRise .4s ease both" }}>
                    <CheckCircle2 size={32} className="text-[#4ADE80] mx-auto mb-2" />
                    <div className="text-[13px] font-bold mb-1">{t("tg.hkSent")}</div>
                    <div className="text-[11.5px] text-[#93a5ba]">{t("tg.hkSentSub")}</div>
                  </div>
                ) : (
                  <>
                    <input value={pmEmail} onChange={(e) => setPmEmail(e.target.value)} type="email" placeholder={t("tg.phEmail")} className="w-full bg-white/5 border m-divider rounded-lg py-2.5 px-3 text-[13px] outline-none focus:border-[#3D7FFF] mb-2.5" />
                    {pmError && <p className="text-[12px] text-[#FF6B85] mb-2.5">{pmError}</p>}
                    <button onClick={requestPartnerInvite} disabled={pmBusy} className={buttonCls}>
                      <span className="flex items-center justify-center gap-2">{pmBusy ? <Loader2 size={16} className="animate-spin" /> : t("tg.hkGetLink")}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "topup") {
    return (
      <div className={`${bgCls} p-5 relative`}>
        <FloatingAmbience />
        <div className="relative z-10">
        <ScreenHeader title={t("tg.topupTitle")} onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <div>
          <div className="flex items-center gap-1.5 mb-4">
            {[1, 2, 3].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= tuStep ? "bg-accent" : "bg-white/10"}`} />)}
          </div>

          {tuStep === 1 && (
            <div>
              <PlatformField platform={tuPlatform} setPlatform={setTuPlatform} customPlatform={tuCustomPlatform} setCustomPlatform={setTuCustomPlatform} />
              <div className="mb-3.5">
                <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.accId")}</label>
                <input className={inputCls} placeholder={t("tg.accIdPh")} value={tuAccountId} onChange={(e) => setTuAccountId(e.target.value)} />
              </div>
              {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
              <button type="button" onClick={verifyTopupId} disabled={tuVerifying} className={buttonCls}>
                {tuVerifying ? <Loader2 size={16} className="animate-spin" /> : t("tg.verify")}
              </button>
            </div>
          )}

          {tuStep === 2 && tuNeedsFullName && (
            <div>
              <div className="mb-3.5">
                <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.fullNamePrompt")}</label>
                <input className={inputCls} placeholder={t("tg.fullNamePh")} value={tuFullNameInput} onChange={(e) => setTuFullNameInput(e.target.value)} />
              </div>
              {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
              <button type="button" onClick={submitFullNameAndRetry} disabled={tuSavingFullName} className={buttonCls}>
                {tuSavingFullName ? <Loader2 size={16} className="animate-spin" /> : t("tg.submitName")}
              </button>
            </div>
          )}

          {tuStep === 2 && !tuNeedsFullName && (
            <div>
              <div className="mb-3.5">
                <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.sum")}</label>
                <input className={inputCls} type="number" min={1} placeholder={t("tg.phSum")} value={tuAmount} onChange={(e) => setTuAmount(e.target.value)} />
              </div>
              <PaymentMethodPicker value={tuMethod} onChange={setTuMethod} />
              {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
              <button type="button" onClick={createTopupOrder} disabled={tuCreatingOrder} className={buttonCls}>
                {tuCreatingOrder ? <Loader2 size={16} className="animate-spin" /> : t("tg.continueBtn")}
              </button>
            </div>
          )}

          {tuStep === 3 && (
            <form onSubmit={submitTopup}>
              {tuRequisite && (
                <div className="mb-4">
                  <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.payMethod")}</label>
                  <LuxuryCard
                    typeLabel={
                      tuRequisite.methodType === "click" ? "Click"
                      : tuRequisite.methodType === "payme" ? "Payme"
                      : tuRequisite.methodType === "card" ? t("tg.mCardShort")
                      : t("tg.mCryptoShort")
                    }
                    number={tuRequisite.accountNumber}
                    holderName={tuRequisite.holderName || null}
                    readOnly
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.receipt")}</label>
                <label className="flex items-center justify-center gap-2 w-full bg-[var(--surf-2)] border border-[var(--border-subtle)] rounded-xl py-3.5 px-4 text-[13px] text-[#7db8ff] cursor-pointer">
                  <Upload size={15} />
                  {tuReceiptFileName || t("tg.pickImage")}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleReceiptSelect} />
                </label>
              </div>
              <p className="text-[11px] text-[#5b7089] mb-4 leading-relaxed">
                {t("tg.receiptHint")}
              </p>
              {error && <p className="text-[12px] text-[#FF6B85] text-center mb-3">{error}</p>}
              <button type="submit" disabled={submitting} className={buttonCls}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : t("tg.paid")}
              </button>
            </form>
          )}
        </div>
        </div>
      </div>
    );
  }

  if (screen === "withdraw") {
    return (
      <div className={`${bgCls} p-5 relative`}>
        <FloatingAmbience />
        <div className="relative z-10">
        <ScreenHeader title={t("tg.withdrawTitle")} onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <WithdrawCodeGuide />
        <WithdrawWizard
          getInitData={getInitData}
          inputCls={inputCls}
          buttonCls={buttonCls}
          onDone={() => { setSuccessLabel("Pul yechish"); resetForms(); setScreen("order-success"); }}
        />
        </div>
      </div>
    );
  }

  if (screen === "orders") {
    const ORDER_FILTERS: { id: "all" | "pending" | "completed" | "rejected"; label: string }[] = [
      { id: "all", label: t("tg.fAll") },
      { id: "pending", label: t("tg.stPending") },
      { id: "completed", label: t("tg.stCompleted") },
      { id: "rejected", label: t("tg.stRejected") },
    ];
    const filteredOrders = ordersFilter === "all" ? orders : orders.filter((o) => o.status === ordersFilter);
    return (
      <div className={`${bgCls} p-5 m-screen-pb`}>
        <ScreenHeader title={t("tg.ordersTitle")} onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {ORDER_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setOrdersFilter(f.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border whitespace-nowrap ${
                ordersFilter === f.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] m-divider text-[#93a5ba]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {ordersLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-accent" /></div>
        ) : filteredOrders.length === 0 ? (
          <p className="text-[13px] text-[#93a5ba] text-center mt-8">
            {orders.length === 0 ? t("tg.noOrders") : t("tg.noInStatus")}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((o) => {
              const s = STATUS_LABEL[o.status];
              const Icon = s.icon;
              return (
                <div key={o.id} className="rounded-xl bg-gradient-to-b from-[var(--surf-2)] to-[var(--surf)] border border-[var(--border-subtle)] p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-bold">{o.type === "topup" ? t("tg.topupTitle") : t("tg.withdrawTitle")}</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: s.color }}>
                      <Icon size={12} /> {t(s.labelKey as any)}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#93a5ba]">{o.platform} · ID: {o.account_id}</div>
                  <div className="text-[14px] font-bold mt-1">{Number(o.amount).toLocaleString("ru-RU")} {t("tg.sumUnit")}</div>

                  {/* Pul yo'li — 4 bekatli progress (MoneyRail) */}
                  <MoneyRail order={o} />

                  {o.operator_note && <div className="text-[11px] text-[#93a5ba] mt-2.5 italic">{o.operator_note}</div>}

                  {/* W2.4: kod eskirib payout muvaffaqiyatsiz bo'lgan bo'lsa — yangi kod so'raladi. */}
                  {o.type === "withdraw" && o.status === "pending" && o.payout_status === "none" && (o.payout_attempt_count ?? 0) > 0 && (
                    <WithdrawCodeRefresh orderId={o.id} getInitData={getInitData} onSubmitted={refreshOrders} inputCls={inputCls} buttonCls={buttonCls} />
                  )}

                  <div className="text-[10px] text-[#5b7089] mt-2">{new Date(o.created_at).toLocaleString()}</div>
                  <button
                    onClick={() => openSupport(o.id)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg bg-white/[0.04] border m-divider text-[#93a5ba] active:bg-white/[0.08]"
                  >
                    <Headset size={13} /> {t("tg.writeAbout")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <BottomNav current={screen} onNavigate={navigateTab} />
      </div>
    );
  }

  if (screen === "support") {
    // F2b: buyurtma orqali kirilganda composer ustida biriktirilgan karta.
    const selectedOrder = selectedOrderId ? orders.find((o) => o.id === selectedOrderId) ?? null : null;
    return (
      <div className={`${bgCls} flex flex-col`} style={{ height: supportViewportH ? `${supportViewportH}px` : "100dvh" }}>
        {imageDraft && (
          <div className="fixed inset-0 z-[65] bg-black/85 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <button onClick={cancelImageDraft} className="text-[13px] text-white/80 active:text-white">{t("tg.cancel")}</button>
              <span className="text-[13px] font-semibold">{t("tg.sendImage")}</span>
              <span className="w-12" />
            </div>
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <img src={imageDraft.previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
            <div className="flex items-center gap-2 p-3 shrink-0">
              <input
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmSendImage(); }}
                placeholder={t("tg.phCaption")}
                className="flex-1 min-w-0 bg-[var(--surf-2)] border border-[var(--border-subtle)] rounded-lg py-2.5 px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
              />
              <button onMouseDown={(e) => e.preventDefault()} onClick={confirmSendImage} className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] flex items-center justify-center" aria-label={t("tg.send")}>
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 pb-2 shrink-0 bg-white/[0.04] backdrop-blur-xl border-b m-divider z-10">
          <div className="flex items-center justify-between -mt-1">
            <ScreenHeader title={t("tg.chatTitle")} onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
            <button onClick={() => setShowThemePicker((v) => !v)} className="p-2 rounded-lg active:bg-white/5 -mt-5" aria-label={t("tg.chatTheme")}>
              <Palette size={17} />
            </button>
          </div>
          {showThemePicker && (
            <div className="mt-2 p-3 rounded-xl bg-white/[0.04] border m-divider">
              <p className="text-[11px] text-[#93a5ba] mb-2">{t("tg.chatThemeHint")}</p>
              <ThemePicker value={myChatTheme} onChange={changeChatTheme} />
            </div>
          )}
        </div>
        <div
          ref={supportListRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
            supportNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            // Tepaga yaqinlashganda eski (oldingi 50 tadan tashqari) xabarlarni yuklaymiz.
            if (el.scrollTop < 60) void loadMoreSupport();
          }}
          className="flex-1 overflow-y-auto px-4 pt-2 space-y-2 min-h-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 22px, black calc(100% - 8px), transparent 100%)",
            maskImage: "linear-gradient(to bottom, transparent 0, black 22px, black calc(100% - 8px), transparent 100%)",
          }}
        >
          {supportLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-accent" /></div>
          ) : supportMessages.length === 0 ? (
            <p className="text-[12px] text-[#93a5ba] text-center mt-8">{t("tg.chatEmpty")}</p>
          ) : (
            <>
            {supportLoadingMore && (
              <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-accent" /></div>
            )}
            {supportMessages.map((m, i) => {
              const prev = i > 0 ? supportMessages[i - 1] : null;
              const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const quoted = supportMessageById(m.reply_to_id);
              const quotedLabel = quoted ? (quoted.sender === "customer" ? t("tg.you") : t("tg.operator")) : null;
              return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] text-white/75 bg-black/30 px-2.5 py-0.5 rounded-full backdrop-blur-sm">{dayLabel(t, m.created_at)}</span>
                  </div>
                )}
              <div className={`flex flex-col ${m.sender === "customer" ? "items-end" : "items-start"}`}>
                {m.sender === "operator" && <span className="text-[9px] text-[#7db8ff] mb-0.5 px-1 font-medium">{t("tg.operatorLabel")}</span>}
                <div
                  onClick={m.sender === "customer" && m.status === "failed" ? () => setFailedMenuFor((f) => (f === m.clientId ? null : m.clientId ?? null)) : undefined}
                  {...(m.status !== "sending" && !m.message?.startsWith("__END_CONFIRM__") ? bindMessageGestures(m, !!m.message && !m.image_path && !m._localImageUrl && !m.voice_path) : {})}
                  className={`max-w-[78%] rounded-2xl ${(m.image_path || m._localImageUrl) ? "p-1" : "px-3 py-1.5"} text-[12.5px] leading-snug select-none transition-transform active:scale-[0.97] text-white bg-[#0f2137]/80 backdrop-blur-md border ${m.sender === "customer" ? "border-[#3D7FFF]/30 shadow-[0_2px_16px_rgba(61,127,255,0.20)]" : "m-divider shadow-[0_2px_14px_rgba(120,180,255,0.12)]"}${m.sender === "customer" && m.status === "failed" ? " cursor-pointer" : ""}`}
                >
                  {quoted && (
                    <div className={`mb-1.5 pl-2 border-l-2 text-[10.5px] opacity-70 truncate max-w-[220px] ${m.sender === "customer" ? "m-divider" : "border-accent/50"}`}>
                      <span className="font-semibold">{quotedLabel}</span>{" "}
                      {quoted.message || (quoted.image_path ? t("tg.photo") : quoted.voice_path ? t("tg.voiceMsg") : "")}
                    </div>
                  )}
                  {m.order_id && (() => {
                    const o = orders.find((x) => x.id === m.order_id);
                    return o ? (
                      <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 text-[10px] text-[#cfe0f5]">
                        <ListOrdered size={11} className="text-[#7db8ff] shrink-0" />
                        <span className="truncate">{o.type === "topup" ? t("tg.topupTitle") : t("tg.withdrawTitle")} · {Number(o.amount).toLocaleString("ru-RU")} {t("tg.sumUnit")} · ID {o.account_id}</span>
                      </div>
                    ) : null;
                  })()}
                  {m.voice_path ? (
                    <VoicePlayer path={m.voice_path} getInitData={getInitData} />
                  ) : (m.image_path || m._localImageUrl) ? (
                    <div>
                      <CustomerSupportImage localUrl={m._localImageUrl} path={m.image_path} getInitData={getInitData} onOpen={setFullscreenImage} />
                      {m.message && <div className="text-[12px] mt-1 whitespace-pre-wrap break-words">{m.message}</div>}
                    </div>
                  ) : m.message?.startsWith("__END_CONFIRM__") ? (
                    <div>
                      <div className="mb-2">{m.message.replace("__END_CONFIRM__", "")}</div>
                      {respondedEndConfirmIds[m.id] !== undefined ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#7db8ff]">
                          <CheckCircle2 size={13} />
                          {respondedEndConfirmIds[m.id] ? t("tg.endAnsweredYes") : t("tg.endAnsweredNo")}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmEnd(m.id, true)}
                            disabled={endConfirmSendingId === m.id}
                            className="flex-1 flex items-center justify-center text-[12px] py-1.5 rounded-lg bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] text-white font-medium disabled:opacity-60"
                          >
                            {endConfirmSendingId === m.id ? <Loader2 size={14} className="animate-spin" /> : t("tg.endYes")}
                          </button>
                          <button
                            onClick={() => confirmEnd(m.id, false)}
                            disabled={endConfirmSendingId === m.id}
                            className="flex-1 flex items-center justify-center text-[12px] py-1.5 rounded-lg bg-white/10 text-white font-medium disabled:opacity-60"
                          >
                            {endConfirmSendingId === m.id ? <Loader2 size={14} className="animate-spin" /> : t("tg.endNo")}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    m.message
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[8px] text-white/50">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {m.sender === "customer" && m.status === "sending" && <Loader2 size={9} className="animate-spin text-white/60" aria-label={t("tg.sending")} />}
                    {m.sender === "customer" && m.status === "failed" && <span className="text-[9px] font-bold text-[#FF6B85]" aria-label={t("tg.failed")} title={t("tg.failed")}>!</span>}
                  </div>
                </div>
                {/* Part I: oddiy xabar amallari long-press menyusида; bu yerda
                    faqat "failed" uchun Qayta yuborish/Tahrirlash. */}
                {m.sender === "customer" && m.status === "failed" && (
                  <div className="flex items-center gap-2.5 mt-0.5 px-1 flex-row-reverse">
                    {failedMenuFor === m.clientId ? (
                      <>
                        <button onClick={() => retrySupportMessage(m.clientId!)} className="text-[10px] text-[#7db8ff] active:text-white flex items-center gap-0.5 font-medium">
                          <RotateCcw size={10} /> Qayta yuborish
                        </button>
                        <button onClick={() => editSupportMessage(m.clientId!)} className="text-[10px] text-[#F4C76A] active:text-white flex items-center gap-0.5 font-medium">
                          <Pencil size={10} /> Tahrirlash
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-[#FF6B85]/70">{t("tg.failedTap")}</span>
                    )}
                  </div>
                )}
              </div>
              </React.Fragment>
              );
            })}
            </>
          )}
          <div ref={supportBottomRef} />
        </div>

        {/* Part I: pastga qaytish tugmasi — faqat tepaga scroll qilinganda. */}
        {showScrollDown && (
          <button
            onClick={() => { supportBottomRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollDown(false); }}
            className="fixed right-3 bottom-20 z-[60] w-10 h-10 rounded-full bg-[var(--surf-3)]/90 backdrop-blur border m-divider flex items-center justify-center shadow-lg active:scale-95"
            aria-label={t("tg.scrollDown")}
          >
            <ChevronDown size={20} className="text-white" />
          </button>
        )}

        {/* Xabar amallari (long-press) — xabar ustida popover (Telegram uslubi).
            Ekranning istalgan joyiga tegsa yopiladi. */}
        {msgMenuFor && msgMenuPos && (
          <div className="fixed inset-0 z-[85]" onClick={() => setMsgMenuFor(null)}>
            <div
              className={`absolute w-40 select-none bg-[var(--surf-3)]/95 backdrop-blur-xl rounded-2xl border m-divider shadow-[0_10px_34px_rgba(0,0,0,0.55)] p-1 ${menuArmed ? "" : "pointer-events-none opacity-95"}`}
              style={{
                left: Math.max(8, Math.min(msgMenuPos.x - 80, (typeof window !== "undefined" ? window.innerWidth : 360) - 168)),
                top: Math.max(8, msgMenuPos.y - 104),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {msgMenuFor.message && !msgMenuFor.message.startsWith("__END_CONFIRM__") && (
                <button onClick={() => { copyMessageText(msgMenuFor.message!); setMsgMenuFor(null); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:bg-white/10 text-[13.5px] text-white">
                  <Copy size={15} className="text-[#7db8ff]" /> Nusxalash
                </button>
              )}
              {msgMenuFor.sender === "customer" && !msgMenuFor.clientId && (
                <button onClick={() => { const id = msgMenuFor.id; setMsgMenuFor(null); deleteSupportMessage(id); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:bg-white/10 text-[13.5px] text-[#FF6B85]">
                  <Trash2 size={15} /> O'chirish
                </button>
              )}
            </div>
          </div>
        )}

        {/* To'liq ekran rasm — qo'lda zoom; BackButton yopadi (menyuga chiqmaydi). */}
        {fullscreenImage && <FullscreenImage src={fullscreenImage} onClose={() => setFullscreenImage(null)} />}
        {/* F2b: "Nusxalandi" bildirishnomasi. */}
        {copiedToast && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] px-3 py-1.5 rounded-full bg-black/80 text-white text-[12px] shadow-lg">
            {t("tg.copied")}
          </div>
        )}

        {/* Part I: buyurtma orqali kirilganda biriktirilgan karta (faqat old
            tomon — sabab/operator faqat operator panelida ko'rinadi). */}
        {selectedOrder && (
          <div className="px-3 pt-2 shrink-0">
            <div className="rounded-xl bg-white/[0.05] border m-divider px-3 py-2 flex items-center gap-2">
              <ListOrdered size={15} className="text-[#7db8ff] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">
                  {selectedOrder.type === "topup" ? t("tg.topupTitle") : t("tg.withdrawTitle")} · {Number(selectedOrder.amount).toLocaleString("ru-RU")} {t("tg.sumUnit")}
                </div>
                <div className="text-[10px] text-[#93a5ba] truncate">{selectedOrder.platform} · ID {selectedOrder.account_id} · {t(STATUS_LABEL[selectedOrder.status].labelKey as any)}</div>
              </div>
              <button onClick={() => setSelectedOrderId(null)} className="shrink-0 p-1 rounded active:bg-white/10 text-[#93a5ba]" aria-label={t("tg.removeOrder")}><XCircle size={14} /></button>
            </div>
          </div>
        )}
        {supportReplyTo && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--surf-2)]">
            <Reply size={12} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0 text-[11px] text-[#93a5ba] truncate">
              {supportReplyTo.message || (supportReplyTo.image_path ? t("tg.photo") : supportReplyTo.voice_path ? t("tg.voiceMsg") : "")}
            </div>
            <button onClick={() => { setSupportReplyTo(null); setSupportError(""); }} className="shrink-0 p-1 rounded active:bg-white/10 text-[#93a5ba]">
              <XCircle size={13} />
            </button>
          </div>
        )}
        {supportError && (
          <p className="px-4 py-1.5 text-[11px] text-[var(--red)] bg-[var(--red)]/10">{supportError}</p>
        )}
        {/* Support chatda ovoz YO'Q — faqat rasm/fayl + matn. */}
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <label className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] cursor-pointer">
            <Paperclip size={14} className="text-[#7db8ff]" />
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={sendSupportImage} disabled={supportSending} />
          </label>
          <input
            ref={supportInputRef}
            className="flex-1 min-w-0 bg-[var(--surf-2)] border border-[var(--border-subtle)] rounded-lg py-2 px-3 text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
            placeholder={t("tg.phMessage")}
            value={supportText}
            onChange={(e) => { setSupportText(e.target.value); setSupportError(""); }}
            onKeyDown={(e) => e.key === "Enter" && sendSupportMessage()}
          />
          <button onMouseDown={(e) => e.preventDefault()} onClick={sendSupportMessage} disabled={!supportText.trim()} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] disabled:opacity-50">
            <Send size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (screen === "promo") {
    return (
      <div className={`${bgCls} p-5 m-screen-pb`}>
        <ScreenHeader title={t("tg.prizeTitle")} onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <PrizeCard initData={getInitData()} />
        <BottomNav current={screen} onNavigate={navigateTab} />
      </div>
    );
  }

  // menu
  return (
    <div className={`${bgCls} p-5 m-screen-pb relative`}>
      <FloatingAmbience />
      <div className="relative z-10">
      <div className="rounded-2xl bg-gradient-to-br from-[var(--surf-3)] to-[var(--surf)] border border-[var(--border-subtle)] p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-[#93a5ba] mb-1">{t("tg.welcome")}</p>
            <p className="text-[20px] font-extrabold" style={titleShadow}>{customer?.full_name || customer?.phone}</p>
            <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-bold tracking-wide" style={{ color: "var(--em)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--em)", boxShadow: "0 0 6px var(--em)" }} />
              {t("tg.onlineLabel")}
            </span>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="flex items-center rounded-lg bg-white/[0.08] p-0.5 text-[11px] font-semibold">
              {(["uz", "ru"] as const).map((lng) => (
                <button
                  key={lng}
                  onClick={() => setLocale(lng)}
                  className={`px-2 py-1 rounded-md transition-colors ${locale === lng ? "bg-[#3D7FFF] text-white" : "text-[#93a5ba]"}`}
                  aria-label={lng === "uz" ? "O'zbekcha" : "Русский"}
                >
                  {lng === "uz" ? "UZ" : "RU"}
                </button>
              ))}
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.08] text-[11px] text-[#93a5ba] active:bg-white/[0.14]" aria-label={t("tg.logout")}>
              <LogOut size={13} /> {t("tg.logout")}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <HeroPrizeCard initData={getInitData()} />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <button onClick={() => { setError(""); setScreen("topup"); }} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3D7FFF] to-[#2456c9] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Download size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">{t("tg.mTopup")}</div>
        </button>
        <button onClick={() => { setError(""); setScreen("withdraw"); }} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4C76A] to-[#c99a3e] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <ArrowUpFromLine size={17} className="text-[#2a1e05]" />
          </div>
          <div className="text-[13px] font-bold">{t("tg.mWithdraw")}</div>
        </button>
        <button onClick={openOrders} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4ADE80] to-[#22a355] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <ListOrdered size={17} className="text-[#06170e]" />
          </div>
          <div className="text-[13px] font-bold">{t("tg.mOrders")}</div>
        </button>
        <button onClick={() => openSupport()} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f2d9c] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Headset size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">{t("tg.mSupport")}</div>
        </button>
      </div>

      {/* Hamkorlik — marketing banner (faqat bizning app'da; hamkor app'da yashiriladi) */}
      {!partnerId && (
      <button
        onClick={() => { setError(""); setScreen("hamkorlik"); }}
        className="group relative w-full mt-3.5 overflow-hidden rounded-2xl p-[1.5px] text-left shadow-[7px_7px_18px_rgba(0,0,0,0.45),-4px_-4px_14px_rgba(120,180,255,0.1)] active:translate-y-[2px] transition-all"
        style={{ background: "linear-gradient(120deg,#F4C76A,#3D7FFF,#7c3aed,#F4C76A)", backgroundSize: "300% 100%", animation: "hkShimmer 6s linear infinite" }}
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-[var(--surf-2)] to-[var(--surf)] px-4 py-3.5 flex items-center gap-3.5">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#F4C76A] to-[#c99a3e] flex items-center justify-center shadow-[3px_3px_10px_rgba(0,0,0,0.45)]" style={{ animation: "hkFloat 3.4s ease-in-out infinite" }}>
            <Handshake size={20} className="text-[#2a1e05]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold flex items-center gap-1.5">{t("tg.becomePartner")} <Sparkles size={13} className="text-[#F4C76A]" /></div>
            <div className="text-[11px] text-[#93a5ba] mt-0.5">{t("tg.becomePartnerSub")}</div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-[#93a5ba] group-active:translate-x-0.5 transition-transform" />
        </div>
      </button>
      )}

      {/* Sovrin kartasi — aksiya bannerи (bizning app) */}
      {!partnerId && (
      <button
        onClick={() => { setError(""); setScreen("promo"); }}
        className="group relative w-full mt-3.5 overflow-hidden rounded-2xl p-[1.5px] text-left shadow-[7px_7px_18px_rgba(0,0,0,0.45),-4px_-4px_14px_rgba(28,224,195,0.12)] active:translate-y-[2px] transition-all"
        style={{ background: "linear-gradient(120deg,#1CE0C3,#F4C76A,#1CE0C3)", backgroundSize: "300% 100%", animation: "hkShimmer 6s linear infinite" }}
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-[#04231F] to-[#0a2e28] px-4 py-3.5 flex items-center gap-3.5">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#1CE0C3] to-[#0a8f7d] flex items-center justify-center shadow-[3px_3px_10px_rgba(0,0,0,0.45)]" style={{ animation: "hkFloat 3.4s ease-in-out infinite" }}>
            <Gift size={20} className="text-[#04231F]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold flex items-center gap-1.5">{t("tg.prizeCard")} <Sparkles size={13} className="text-[#F4C76A]" /></div>
            <div className="text-[11px] text-[#93a5ba] mt-0.5">{t("tg.prizeCardSub")}</div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-[#93a5ba] group-active:translate-x-0.5 transition-transform" />
        </div>
      </button>
      )}

      {/* Reklama banner (bizning app) */}
      {!partnerId && <PromoBanner />}

      <style>{`
        @keyframes hkShimmer { 0%{background-position:0% 0} 100%{background-position:300% 0} }
        @keyframes hkFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes hkGlow { 0%,100%{box-shadow:0 0 26px 4px rgba(244,199,106,0.28)} 50%{box-shadow:0 0 40px 10px rgba(61,127,255,0.34)} }
        @keyframes hkRise { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      </div>
      <BottomNav current={screen} onNavigate={navigateTab} />
    </div>
  );
}
