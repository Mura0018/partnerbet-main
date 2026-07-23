"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Download, ArrowUpFromLine, ListOrdered, Headset, Loader2, ChevronLeft, ChevronDown, Send, CheckCircle2, XCircle, Clock, Upload, Paperclip, Mic, Trash2, Check, Home, LogOut, Reply, Palette, RotateCcw, Pencil, Copy,
} from "lucide-react";

declare global {
  interface Window {
    Telegram?: { WebApp: any };
  }
}

type Customer = { id: string; full_name: string | null; phone: string };
type Screen = "loading" | "auth" | "menu" | "topup" | "withdraw" | "orders" | "support" | "order-success" | "forgot-password";
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

type PaymentInfo = {
  cardNumber: string; cardHolder: string; cardOperatorId: string | null;
  clickNumber: string; clickHolder: string; clickOperatorId: string | null;
  paymeNumber: string; paymeHolder: string; paymeOperatorId: string | null;
  cryptoWallet: string; cryptoOperatorId: string | null;
};

const PLATFORMS = ["1xBet", "Melbet", "Betwinner", "Boshqa"];
const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "click", label: "Click" },
  { id: "payme", label: "Payme" },
  { id: "card", label: "Bank kartasi" },
  { id: "crypto", label: "Crypto (USDT)" },
];
const STATUS_LABEL: Record<Order["status"], { label: string; color: string; icon: any }> = {
  pending: { label: "Kutilmoqda", color: "#F4C76A", icon: Clock },
  completed: { label: "Bajarildi", color: "#4ADE80", icon: CheckCircle2 },
  rejected: { label: "Rad etildi", color: "#FF6B85", icon: XCircle },
};

const inputCls =
  "w-full bg-[#0e2038] rounded-xl py-3.5 px-4 text-[14px] text-white outline-none placeholder:text-[#5b7089] transition-shadow duration-200 focus:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),0_0_0_2px_rgba(61,127,255,0.5),0_0_16px_rgba(61,127,255,0.35)] " +
  "shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(120,180,255,0.06)] " +
  "focus:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(120,180,255,0.12),0_0_0_2px_rgba(61,127,255,0.4)] transition-shadow";

const selectCls = inputCls + " appearance-none";

const buttonCls =
  "w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-[15px] text-white " +
  "bg-gradient-to-br from-[#3D7FFF] via-[#4f6bff] to-[#7c3aed] " +
  "shadow-[7px_7px_16px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(120,180,255,0.15)] " +
  "active:translate-y-[3px] active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.4),inset_-2px_-2px_6px_rgba(255,255,255,0.05)] " +
  "transition-all disabled:opacity-50";

const titleShadow = {
  textShadow: "4px 5px 10px rgba(0,0,0,0.6), -2px -2px 5px rgba(120,180,255,0.3), 0 0 20px rgba(80,150,255,0.25)",
};

const menuCardCls =
  "rounded-2xl bg-gradient-to-b from-[#0e2038] to-[#0a1a30] p-4 text-left " +
  "shadow-[7px_7px_16px_rgba(0,0,0,0.5),-4px_-4px_12px_rgba(120,180,255,0.08)] " +
  "active:translate-y-[3px] active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.4)] transition-all";

const bgCls = "min-h-screen bg-gradient-to-b from-[#123f77] via-[#0f3364] to-[#0a1a30] text-white";

function VoicePlayer({ path, getInitData }: { path: string; getInitData: () => string }) {
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

  if (loading) return <p className="text-[12px] text-white/70">Yuklanmoqda…</p>;
  if (!url) return <p className="text-[12px] text-[#FF6B85]">Ovozli xabarni yuklab bo'lmadi.</p>;
  return <audio controls src={url} className="max-w-[190px] h-8" />;
}

// F2: mijoz chat bubble'ida rasmni ko'rsatadi. Optimistik holatda mahalliy
// `localUrl` (upload'gача), aks holda `path` bo'yicha himoyalangan media-url.
function CustomerSupportImage({ localUrl, path, getInitData, onOpen }: { localUrl?: string; path?: string | null; getInitData: () => string; onOpen: (url: string) => void }) {
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
  if (!url) return <p className="text-[11px] text-white/70">Rasm yuklanmoqda…</p>;
  // F2b: to'liq ochish sahifa darajasида boshqariladi (BackButton uni yopadi).
  return <img src={url} alt="Rasm" onClick={() => onOpen(url)} className="max-w-[200px] rounded-lg cursor-zoom-in" />;
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
      <label className="block text-[12px] text-[#93a5ba] mb-1.5">Hisob ID raqami</label>
      <div style={{ perspective: "1200px" }}>
        <div
          className="relative transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none", minHeight: "50px" }}
        >
          <div className="flex gap-2" style={{ backfaceVisibility: "hidden" }}>
            <input
              className={`${inputCls} flex-1`}
              placeholder="Masalan: 123456789"
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
              {verifying ? <Loader2 size={15} className="animate-spin" /> : "Tekshirish"}
            </button>
          </div>
          <div
            className="absolute inset-0 flex items-center gap-3 bg-[#0e2038] rounded-xl px-4 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(120,180,255,0.06)]"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="w-9 h-9 rounded-full bg-[#4ADE80]/15 flex items-center justify-center text-[#4ADE80] shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold truncate">{verifiedName}</div>
              <div className="text-[10px] text-[#93a5ba]">ID: {accountId} — tasdiqlangan</div>
            </div>
            <button type="button" onClick={() => { setFlipped(false); setVerifiedName(null); }} className="shrink-0 text-[11px] text-[#7db8ff]">
              O'zgartirish
            </button>
          </div>
        </div>
      </div>
      {notFound && (
        <p className="text-[11px] text-[#F4C76A] mt-1.5">Bu ID bo'yicha ma'lumot topilmadi — to'g'ri kiritganingizga ishonch hosil qiling. Baribir davom etishingiz mumkin.</p>
      )}
    </div>
  );
}


function ScreenHeader({ title, onBack, onHome }: { title: string; onBack: () => void; onHome?: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <button onClick={onBack} className="p-2 -ml-2 rounded-lg active:bg-white/5" aria-label="Orqaga">
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-[18px] font-bold flex-1">{title}</h1>
      {onHome && (
        <button onClick={onHome} className="p-2 rounded-lg active:bg-white/5" aria-label="Bosh sahifa">
          <Home size={18} />
        </button>
      )}
    </div>
  );
}

function PaymentMethodPicker({
  value,
  onChange,
  paymentInfo,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  paymentInfo: PaymentInfo | null;
}) {
  const detail: Record<PaymentMethod, { number: string; holder: string; label: string } | null> = {
    click: paymentInfo?.clickNumber ? { number: paymentInfo.clickNumber, holder: paymentInfo.clickHolder, label: "Click" } : null,
    payme: paymentInfo?.paymeNumber ? { number: paymentInfo.paymeNumber, holder: paymentInfo.paymeHolder, label: "Payme" } : null,
    card: paymentInfo?.cardNumber ? { number: paymentInfo.cardNumber, holder: paymentInfo.cardHolder, label: "Karta" } : null,
    crypto: paymentInfo?.cryptoWallet ? { number: paymentInfo.cryptoWallet, holder: "", label: "USDT (TRC20)" } : null,
  };
  return (
    <div className="mb-3.5">
      <label className="block text-[12px] text-[#93a5ba] mb-1.5">To'lov usuli</label>
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
              value === m.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {detail[value] ? (
        <LuxuryCard
          typeLabel={detail[value]!.label}
          number={detail[value]!.number}
          holderName={detail[value]!.holder || null}
          readOnly
        />
      ) : (
        <div className="rounded-lg bg-[#F4C76A]/10 border border-[#F4C76A]/25 px-3.5 py-2.5 text-[12px] text-[#F4C76A]">
          Bu usul uchun ma'lumot hali kiritilmagan. Boshqa usulni tanlang yoki operator bilan bog'laning.
        </div>
      )}
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
  return (
    <>
      <div className="mb-3.5">
        <label className="block text-[12px] text-[#93a5ba] mb-1.5">Platforma</label>
        <select className={selectCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      {platform === "Boshqa" && (
        <input
          className={`${inputCls} mb-3.5`}
          placeholder="Platforma nomi"
          value={customPlatform}
          onChange={(e) => setCustomPlatform(e.target.value)}
        />
      )}
    </>
  );
}

// H2: mijoz tomonда matn/rasm yuborishda API xatosini do'stona matnga
// aylantiradi (xom JSON emas). `kind` umumiy fallback matnini tanlaydi.
function supportSendErrorMessage(error: unknown, status: number, kind: "message" | "image"): string {
  if (status === 429 || error === "rate_limited") {
    return "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.";
  }
  if (status === 401 || error === "not_registered" || error === "invalid_signature" || error === "not_configured") {
    return "Sessiya tugagan. Ilovani qayta oching.";
  }
  if (kind === "image" && error === "invalid_image_size") {
    return "Rasm hajmi juda katta.";
  }
  return kind === "image"
    ? "Rasm yuborilmadi. Qayta urinib ko'ring."
    : "Xabar yuborilmadi. Qayta urinib ko'ring.";
}

// Part I: kun ajratgichi yorlig'i (Telegram uslubi: Bugun / Kecha / sana).
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Bugun";
  if (diffDays === 1) return "Kecha";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export default function TelegramAppPage() {
  const [screen, setScreen] = useState<Screen>("loading");
  // F2b: ochiq overlay (to'liq rasm / rasm preview) ni yopish funksiyasi.
  // BackButton avval shuni yopadi, keyin ekrandan chiqadi.
  const overlayCloserRef = useRef<null | (() => void)>(null);
  // Telegram Mini App BackButton: ichki ekranda ko'rsatiladi, bosilganda
  // menyuga qaytaradi (ilovadan chiqmaydi). Menyuda esa yashiriladi.
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.BackButton) return;
    const isInner = screen === "topup" || screen === "withdraw" || screen === "orders" || screen === "support" || screen === "order-success" || screen === "forgot-password";
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
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);

  // Top-up form
  const [tuPlatform, setTuPlatform] = useState(PLATFORMS[0]);
  const [tuCustomPlatform, setTuCustomPlatform] = useState("");
  const [tuAccountId, setTuAccountId] = useState("");
  const [tuAmount, setTuAmount] = useState("");
  const [tuMethod, setTuMethod] = useState<PaymentMethod>("click");
  const [tuReceiptBase64, setTuReceiptBase64] = useState("");
  const [tuReceiptMime, setTuReceiptMime] = useState("");
  const [tuReceiptFileName, setTuReceiptFileName] = useState("");

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

  useEffect(() => {
    fetch("/api/telegram/miniapp/branding")
      .then((r) => r.json())
      .then((data) => { setLogoUrl(data.logoUrl); if (data.logoPosition) setLogoPos(data.logoPosition); })
      .catch(() => {});
    // payment-info endi himoyalangan (initData talab qiladi) — u faqat
    // Telegram WebApp initData tayyor bo'lgach, script.onload ichida yuklanadi.
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
        setError("Bu ilova faqat Telegram ichida ochilishi kerak.");
        setScreen("auth");
        return;
      }
      // initData tayyor — endi himoyalangan payment-info'ni yuklaymiz.
      fetch(`/api/telegram/miniapp/payment-info?initData=${encodeURIComponent(initData)}`)
        .then((r) => r.json())
        .then((data) => setPaymentInfo(data))
        .catch(() => {});
      try {
        const res = await fetch("/api/telegram/miniapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const data = await res.json();
        if (data.registered) {
          setCustomer(data.customer);
          setScreen("menu");
        } else {
          setScreen("auth");
        }
      } catch {
        setError("Ulanishda xatolik. Qayta urinib ko'ring.");
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
      setError("Telefon raqami va parolni kiriting.");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = mode === "register" ? "/api/telegram/miniapp/register" : "/api/telegram/miniapp/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), phone: phone.trim(), password, fullName: fullName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          phone_taken: "Bu telefon raqami allaqachon ro'yxatdan o'tgan.",
          telegram_already_linked: "Bu Telegram hisobi allaqachon boshqa akkauntga bog'langan.",
          weak_password: "Parol kamida 6 belgidan iborat bo'lishi kerak.",
          not_found: "Bunday hisob topilmadi.",
          wrong_password: "Parol noto'g'ri.",
          linked_to_other_telegram: "Bu hisob boshqa Telegram akkauntiga bog'langan.",
          rate_limited: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
        };
        setError(messages[data.error] ?? "Xatolik yuz berdi.");
        return;
      }
      setCustomer(data.customer);
      setScreen("menu");
    } catch {
      setError("Ulanishda xatolik. Qayta urinib ko'ring.");
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
      setFpError("Kodni kiriting va kamida 6 belgili yangi parol tanlang.");
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
          invalid_code: "Kod noto'g'ri.",
          code_expired: "Kod muddati tugagan. Qaytadan so'rang.",
          weak_password: "Parol kamida 6 belgidan iborat bo'lishi kerak.",
          rate_limited: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
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
    setTuReceiptBase64(""); setTuReceiptMime(""); setTuReceiptFileName("");
    setWdAccountId(""); setWdAmount(""); setWdCode(""); setWdPlatform(PLATFORMS[0]); setWdCustomPlatform(""); setWdMethod("click"); setWdPayoutDetails(""); setWdRecipientName("");
  };

  const handleReceiptSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Faqat rasm fayli (PNG/JPEG/WEBP) yuklash mumkin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Rasm hajmi 5MB dan oshmasligi kerak.");
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

  const submitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessWarning(null);
    const platform = tuPlatform === "Boshqa" ? tuCustomPlatform.trim() : tuPlatform;
    if (!platform || !tuAccountId.trim() || !tuAmount || Number(tuAmount) <= 0) {
      setError("Barcha maydonlarni to'ldiring.");
      return;
    }
    if (!tuReceiptBase64) {
      setError("To'lov chekining skrinshotini yuklang.");
      return;
    }
    setSubmitting(true);
    try {
      const methodDetails: Record<PaymentMethod, { number: string; holder: string; operatorId: string | null }> = {
        card: { number: paymentInfo?.cardNumber ?? "", holder: paymentInfo?.cardHolder ?? "", operatorId: paymentInfo?.cardOperatorId ?? null },
        click: { number: paymentInfo?.clickNumber ?? "", holder: paymentInfo?.clickHolder ?? "", operatorId: paymentInfo?.clickOperatorId ?? null },
        payme: { number: paymentInfo?.paymeNumber ?? "", holder: paymentInfo?.paymeHolder ?? "", operatorId: paymentInfo?.paymeOperatorId ?? null },
        crypto: { number: paymentInfo?.cryptoWallet ?? "", holder: "", operatorId: paymentInfo?.cryptoOperatorId ?? null },
      };
      const shown = methodDetails[tuMethod];
      const res = await fetch("/api/telegram/miniapp/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), type: "topup", platform, accountId: tuAccountId.trim(),
          amount: Number(tuAmount), paymentMethod: tuMethod,
          paymentOperatorId: shown.operatorId, receivedAccountNumber: shown.number, receivedHolderName: shown.holder,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "player_not_found") {
          setError("Bunday hisob ID topilmadi. Platforma va ID raqamini tekshiring.");
        } else if (data.error === "order_limit_exceeded") {
          setError(`Bitta buyurtma uchun maksimal summa: ${Number(data.limit).toLocaleString("ru-RU")} so'm.`);
        } else if (data.error === "daily_limit_exceeded") {
          setError(`Kunlik limitga yetdingiz (${Number(data.limit).toLocaleString("ru-RU")} so'm). Ertaga qayta urinib ko'ring yoki operator bilan bog'laning.`);
        } else if (data.error === "too_many_pending_orders") {
          setError("Sizda hozircha ko'rib chiqilayotgan buyurtmalar bor. Iltimos ular yakunlanishini kuting.");
        } else {
          setError("Buyurtma yuborishda xatolik. Qayta urinib ko'ring.");
        }
        return;
      }
      const { order } = await res.json();

      const receiptRes = await fetch("/api/telegram/miniapp/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), orderId: order.id, imageBase64: tuReceiptBase64, mimeType: tuReceiptMime,
        }),
      });
      if (!receiptRes.ok) {
        setSuccessWarning("Buyurtma yaratildi, lekin chek yuklanmadi. \"Operator bilan aloqa\" orqali chekni yuboring.");
      }

      setSuccessLabel("Hisob to'ldirish");
      resetForms();
      setScreen("order-success");
    } catch {
      setError("Buyurtma yuborishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessWarning(null);
    const platform = wdPlatform === "Boshqa" ? wdCustomPlatform.trim() : wdPlatform;
    if (!platform || !wdAccountId.trim() || !wdCode.trim() || !wdAmount || Number(wdAmount) <= 0 || !wdPayoutDetails.trim() || !wdRecipientName.trim()) {
      setError("Barcha maydonlarni to'ldiring.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/telegram/miniapp/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), type: "withdraw", platform, accountId: wdAccountId.trim(),
          amount: Number(wdAmount), paymentMethod: wdMethod, withdrawCode: wdCode.trim(), payoutDetails: wdPayoutDetails.trim(),
          recipientName: wdRecipientName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "player_not_found") {
          setError("Bunday hisob ID topilmadi. Platforma va ID raqamini tekshiring.");
        } else if (data.error === "order_limit_exceeded") {
          setError(`Bitta buyurtma uchun maksimal summa: ${Number(data.limit).toLocaleString("ru-RU")} so'm.`);
        } else if (data.error === "daily_limit_exceeded") {
          setError(`Kunlik limitga yetdingiz (${Number(data.limit).toLocaleString("ru-RU")} so'm). Ertaga qayta urinib ko'ring yoki operator bilan bog'laning.`);
        } else if (data.error === "too_many_pending_orders") {
          setError("Sizda hozircha ko'rib chiqilayotgan buyurtmalar bor. Iltimos ular yakunlanishini kuting.");
        } else {
          setError("Buyurtma yuborishda xatolik. Qayta urinib ko'ring.");
        }
        return;
      }
      setSuccessLabel("Pul yechish");
      resetForms();
      setScreen("order-success");
    } catch {
      setError("Buyurtma yuborishda xatolik. Qayta urinib ko'ring.");
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

  const loadSupport = async (silent = false) => {
    if (!silent) setSupportLoading(true);
    try {
      const res = await fetch(`/api/telegram/miniapp/support?initData=${encodeURIComponent(getInitData())}`);
      const data = await res.json();
      const msgs: SupportMessage[] = data.messages ?? [];
      // F1 merge-reconcile: hali serverда yo'q optimistik (sending/failed)
      // xabarlarni saqlab qolamiz, aks holda 4s poll ularni o'chirib yuboradi.
      // Server versiyasi (real id) paydo bo'lса, optimistik nusxa tushib qoladi
      // (dublikat bo'lmaydi). Imzoga pending holati ham kiritiladi —
      // o'zgarmasa idle render bo'lmaydi. (Imzo yangilash prod build'да xavfsiz;
      // StrictMode dev double-invoke'да ham natija bir xil idempotent bo'ladi.)
      setSupportMessages((prev) => {
        const serverIds = new Set(msgs.map((m) => m.id));
        const pending = prev.filter(
          (m) => m.clientId && (m.status === "sending" || m.status === "failed") && !serverIds.has(m.id)
        );
        const last = msgs[msgs.length - 1];
        const sig = `${msgs.length}:${last?.id ?? ""}:${last?.created_at ?? ""}|${pending
          .map((p) => `${p.clientId}:${p.status}`)
          .join(",")}`;
        if (sig === supportSigRef.current) return prev;
        supportSigRef.current = sig;
        return pending.length ? [...msgs, ...pending] : msgs;
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
    // Buyurtma tanlash uchun mijozning buyurtmalarini yuklaymiz.
    try {
      const ordRes = await fetch(`/api/telegram/miniapp/orders?initData=${encodeURIComponent(getInitData())}`);
      const ordData = await ordRes.json();
      setOrders(ordData.orders ?? []);
    } catch {}
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
    const list = supportListRef.current;
    if (list && list.scrollHeight - list.scrollTop - list.clientHeight >= 80) return;
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

  const confirmEnd = async (resolved: boolean) => {
    try {
      await fetch("/api/telegram/miniapp/support/end-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), resolved }),
      });
      await loadSupport(true);
    } catch {}
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
        setSupportError(supportSendErrorMessage((data as any)?.error, res.status, "message"));
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
          ? "Internet yo'q. Xabar yuborilmadi — ulanish tiklangach qayta urinib ko'ring."
          : "Xabar yuborilmadi. Qayta urinib ko'ring."
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
        setSupportError(supportSendErrorMessage((data as any)?.error, res.status, "image"));
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
        invalid_mime: "Ovoz formati qo'llab-quvvatlanmaydi (qurilma). Boshqa qurilmada urinib ko'ring.",
        invalid_audio: "Ovoz fayli buzuq.",
        invalid_audio_size: "Ovoz hajmi juda katta yoki bo'sh.",
        invalid_duration: "Ovoz davomiyligi noto'g'ri.",
        rate_limited: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
        upload_failed: "Ovozni yuklab bo'lmadi. Qayta urinib ko'ring.",
        insert_failed: "Ovozni saqlab bo'lmadi. Qayta urinib ko'ring.",
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

  if (screen === "auth") {
    return (
      <div className={`${bgCls} p-6 flex flex-col justify-center relative`}>
        <FloatingAmbience />
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
            {mode === "login" ? "Hisobingizga kiring" : "Yangi hisob yarating"}
          </p>

          <form onSubmit={submitAuth} className="space-y-3.5">
            {mode === "register" && (
              <input className={inputCls} placeholder="Ism-familiya (ixtiyoriy)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            )}
            <input className={inputCls} placeholder="Telefon raqami" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <PasswordInput className={inputCls} placeholder="Parol" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-[12px] text-[#FF6B85] text-center">{error}</p>}
            {authInfo && <p className="text-[12px] text-[#4ADE80] text-center">{authInfo}</p>}

            <button type="submit" disabled={submitting} className={buttonCls}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
            </button>
          </form>

          {mode === "login" && (
            <button
              onClick={() => { setFpStep("phone"); setFpPhone(phone); setFpError(""); setFpInfo(""); setScreen("forgot-password"); }}
              className="w-full text-center mt-3.5 text-[12px] text-[#7db8ff]/80"
            >
              Parolni unutdingizmi?
            </button>
          )}

          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setAuthInfo(""); }}
            className="group relative w-full text-center mt-5 py-3 rounded-xl text-[13px] font-bold text-[#7db8ff] bg-[#3D7FFF]/[0.08] border border-[#3D7FFF]/30 overflow-hidden hover:text-white hover:bg-[#3D7FFF]/[0.16] hover:border-[#3D7FFF]/50 transition-all active:scale-[0.98]"
          >
            <span className="pointer-events-none absolute top-0 -left-full w-3/5 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: "loginShimmer 3s infinite" }} />
            <style>{`@keyframes loginShimmer { 0%{left:-100%} 60%,100%{left:200%} }`}</style>
            <span className="relative z-10">{mode === "login" ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting →" : "Hisobingiz bormi? Kiring →"}</span>
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
          <ScreenHeader title="Parolni tiklash" onBack={() => setScreen("auth")} />

          {fpStep === "phone" ? (
            <form onSubmit={requestResetCode} className="space-y-3.5">
              <p className="text-[13px] text-[#93a5ba] mb-1">
                Telefon raqamingizni kiriting — Telegram orqali tasdiqlash kodi yuboramiz.
              </p>
              <input className={inputCls} placeholder="Telefon raqami" value={fpPhone} onChange={(e) => setFpPhone(e.target.value)} inputMode="tel" />
              {fpError && <p className="text-[12px] text-[#FF6B85] text-center">{fpError}</p>}
              <button type="submit" disabled={fpSubmitting} className={buttonCls}>
                {fpSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Kod yuborish"}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmResetPassword} className="space-y-3.5">
              {fpInfo && <p className="text-[12px] text-[#4ADE80] text-center mb-1">{fpInfo}</p>}
              <input className={inputCls} placeholder="Tasdiqlash kodi (6 xonali)" value={fpCode} onChange={(e) => setFpCode(e.target.value)} inputMode="numeric" />
              <PasswordInput className={inputCls} placeholder="Yangi parol" value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)} />
              {fpError && <p className="text-[12px] text-[#FF6B85] text-center">{fpError}</p>}
              <button type="submit" disabled={fpSubmitting} className={buttonCls}>
                {fpSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Parolni yangilash"}
              </button>
              <button
                type="button"
                onClick={() => { setFpStep("phone"); setFpError(""); setFpInfo(""); }}
                className="w-full text-center text-[12px] text-[#7db8ff]/80"
              >
                Boshqa raqamga kod yuborish
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
        <p className="text-[16px] font-bold mb-1.5">{successLabel} buyurtmangiz qabul qilindi</p>
        <p className="text-[13px] text-[#93a5ba] mb-6">Operator tez orada ko'rib chiqadi. Holatni "Buyurtmalarim" bo'limida kuzatishingiz mumkin.</p>
        {successWarning && (
          <p className="text-[12px] text-[#F4C76A] bg-[#F4C76A]/10 border border-[#F4C76A]/30 rounded-lg px-3 py-2 mb-5 max-w-[300px]">{successWarning}</p>
        )}
        <button onClick={() => setScreen("menu")} className={`${buttonCls} max-w-[220px]`}>Menyuga qaytish</button>
        </div>
      </div>
    );
  }

  if (screen === "topup") {
    return (
      <div className={`${bgCls} p-5 relative`}>
        <FloatingAmbience />
        <div className="relative z-10">
        <ScreenHeader title="Hisob to'ldirish" onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <form onSubmit={submitTopup}>
          <PlatformField platform={tuPlatform} setPlatform={setTuPlatform} customPlatform={tuCustomPlatform} setCustomPlatform={setTuCustomPlatform} />
          <AccountIdVerifyField accountId={tuAccountId} setAccountId={setTuAccountId} getInitData={getInitData} />
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Summa</label>
            <input className={inputCls} type="number" min={1} placeholder="Masalan: 50000" value={tuAmount} onChange={(e) => setTuAmount(e.target.value)} />
          </div>
          <PaymentMethodPicker value={tuMethod} onChange={setTuMethod} paymentInfo={paymentInfo} />
          <div className="mb-4">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">To'lov cheki (skrinshot)</label>
            <label className="flex items-center justify-center gap-2 w-full bg-[#0e2038] rounded-xl py-3.5 px-4 text-[13px] text-[#7db8ff] cursor-pointer shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(120,180,255,0.06)]">
              <Upload size={15} />
              {tuReceiptFileName || "Rasm tanlash"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleReceiptSelect} />
            </label>
          </div>
          <p className="text-[11px] text-[#5b7089] mb-4 leading-relaxed">
            Ko'rsatilgan raqamga to'lovni amalga oshirib, chek skrinshotini yuklang va quyidagi tugmani bosing — operator to'lovni tekshirib, hisobingizni to'ldiradi.
          </p>
          {error && <p className="text-[12px] text-[#FF6B85] text-center mb-3">{error}</p>}
          <button type="submit" disabled={submitting} className={buttonCls}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "To'ladim, buyurtma berish"}
          </button>
        </form>
        </div>
      </div>
    );
  }

  if (screen === "withdraw") {
    return (
      <div className={`${bgCls} p-5 relative`}>
        <FloatingAmbience />
        <div className="relative z-10">
        <ScreenHeader title="Pul yechish" onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <WithdrawCodeGuide />
        <form onSubmit={submitWithdraw}>
          <PlatformField platform={wdPlatform} setPlatform={setWdPlatform} customPlatform={wdCustomPlatform} setCustomPlatform={setWdCustomPlatform} />
          <AccountIdVerifyField accountId={wdAccountId} setAccountId={setWdAccountId} getInitData={getInitData} />
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Pul yechish kodi</label>
            <PasswordInput className={inputCls} placeholder="Masalan: A1b2" value={wdCode} onChange={(e) => setWdCode(e.target.value)} />
          </div>
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Summa</label>
            <input className={inputCls} type="number" min={1} placeholder="Masalan: 50000" value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} />
          </div>
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Pulni qabul qilish usuli</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id} type="button" onClick={() => setWdMethod(m.id)}
                  className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                    wdMethod === m.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Qabul qiluvchi raqam/karta</label>
            <input className={inputCls} placeholder="Karta/Click/Payme raqamingiz" value={wdPayoutDetails} onChange={(e) => setWdPayoutDetails(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Karta/hisob egasining F.I.Sh.</label>
            <input className={inputCls} placeholder="Masalan: Aliyev Vali" value={wdRecipientName} onChange={(e) => setWdRecipientName(e.target.value)} />
          </div>
          {error && <p className="text-[12px] text-[#FF6B85] text-center mb-3">{error}</p>}
          <button type="submit" disabled={submitting} className={buttonCls}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Buyurtma berish"}
          </button>
        </form>
        </div>
      </div>
    );
  }

  if (screen === "orders") {
    const ORDER_FILTERS: { id: "all" | "pending" | "completed" | "rejected"; label: string }[] = [
      { id: "all", label: "Barchasi" },
      { id: "pending", label: "Kutilmoqda" },
      { id: "completed", label: "Bajarildi" },
      { id: "rejected", label: "Rad etildi" },
    ];
    const filteredOrders = ordersFilter === "all" ? orders : orders.filter((o) => o.status === ordersFilter);
    return (
      <div className={`${bgCls} p-5`}>
        <ScreenHeader title="Buyurtmalarim" onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {ORDER_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setOrdersFilter(f.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border whitespace-nowrap ${
                ordersFilter === f.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"
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
            {orders.length === 0 ? "Hozircha buyurtmalar yo'q." : "Bu holatda buyurtmalar yo'q."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((o) => {
              const s = STATUS_LABEL[o.status];
              const Icon = s.icon;
              return (
                <div key={o.id} className="rounded-xl bg-gradient-to-b from-[#0e2038] to-[#0a1a30] p-4 shadow-[5px_5px_14px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-bold">{o.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"}</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: s.color }}>
                      <Icon size={12} /> {s.label}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#93a5ba]">{o.platform} · ID: {o.account_id}</div>
                  <div className="text-[14px] font-bold mt-1">{Number(o.amount).toLocaleString("ru-RU")} so'm</div>
                  {o.operator_note && <div className="text-[11px] text-[#93a5ba] mt-1.5 italic">{o.operator_note}</div>}
                  <div className="text-[10px] text-[#5b7089] mt-2">{new Date(o.created_at).toLocaleString()}</div>
                  <button
                    onClick={() => openSupport(o.id)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[#93a5ba] active:bg-white/[0.08]"
                  >
                    <Headset size={13} /> Shu buyurtma bo'yicha yozish
                  </button>
                </div>
              );
            })}
          </div>
        )}
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
              <button onClick={cancelImageDraft} className="text-[13px] text-white/80 active:text-white">Bekor</button>
              <span className="text-[13px] font-semibold">Rasm yuborish</span>
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
                placeholder="Izoh (ixtiyoriy)..."
                className="flex-1 min-w-0 bg-[#0e2038] rounded-lg py-2.5 px-3 text-[13px] text-white outline-none placeholder:text-[#5b7089]"
              />
              <button onMouseDown={(e) => e.preventDefault()} onClick={confirmSendImage} className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] flex items-center justify-center" aria-label="Yuborish">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 pb-2 shrink-0 bg-white/[0.04] backdrop-blur-xl border-b border-white/10 z-10">
          <div className="flex items-center justify-between -mt-1">
            <ScreenHeader title="Operator bilan aloqa" onBack={() => setScreen("menu")} onHome={() => setScreen("menu")} />
            <button onClick={() => setShowThemePicker((v) => !v)} className="p-2 rounded-lg active:bg-white/5 -mt-5" aria-label="Chat mavzusi">
              <Palette size={17} />
            </button>
          </div>
          {showThemePicker && (
            <div className="mt-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <p className="text-[11px] text-[#93a5ba] mb-2">Xabar rangingizni tanlang</p>
              <ThemePicker value={myChatTheme} onChange={changeChatTheme} />
            </div>
          )}
        </div>
        <div
          ref={supportListRef}
          onScroll={(e) => { const el = e.currentTarget; setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 240); }}
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
            <p className="text-[12px] text-[#93a5ba] text-center mt-8">Savolingiz bo'lsa, quyidan yozing — operator tez orada javob beradi.</p>
          ) : (
            supportMessages.map((m, i) => {
              const prev = i > 0 ? supportMessages[i - 1] : null;
              const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const quoted = supportMessageById(m.reply_to_id);
              const quotedLabel = quoted ? (quoted.sender === "customer" ? "Siz" : "Operator") : null;
              return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] text-white/75 bg-black/30 px-2.5 py-0.5 rounded-full backdrop-blur-sm">{dayLabel(m.created_at)}</span>
                  </div>
                )}
              <div className={`flex flex-col ${m.sender === "customer" ? "items-end" : "items-start"}`}>
                {m.sender === "operator" && <span className="text-[9px] text-[#7db8ff] mb-0.5 px-1 font-medium">BetCore Pay operatori</span>}
                <div
                  onClick={m.sender === "customer" && m.status === "failed" ? () => setFailedMenuFor((f) => (f === m.clientId ? null : m.clientId ?? null)) : undefined}
                  {...(m.status !== "sending" && !m.message?.startsWith("__END_CONFIRM__") ? bindMessageGestures(m, !!m.message && !m.image_path && !m._localImageUrl && !m.voice_path) : {})}
                  className={`max-w-[78%] rounded-2xl ${(m.image_path || m._localImageUrl) ? "p-1" : "px-3 py-1.5"} text-[12.5px] leading-snug select-none transition-transform active:scale-[0.97] text-white bg-[#0f2137]/80 backdrop-blur-md border ${m.sender === "customer" ? "border-[#3D7FFF]/30 shadow-[0_2px_16px_rgba(61,127,255,0.20)]" : "border-white/12 shadow-[0_2px_14px_rgba(120,180,255,0.12)]"}${m.sender === "customer" && m.status === "failed" ? " cursor-pointer" : ""}`}
                >
                  {quoted && (
                    <div className={`mb-1.5 pl-2 border-l-2 text-[10.5px] opacity-70 truncate max-w-[220px] ${m.sender === "customer" ? "border-white/50" : "border-accent/50"}`}>
                      <span className="font-semibold">{quotedLabel}</span>{" "}
                      {quoted.message || (quoted.image_path ? "📷 Rasm" : quoted.voice_path ? "🎤 Ovozli xabar" : "")}
                    </div>
                  )}
                  {m.order_id && (() => {
                    const o = orders.find((x) => x.id === m.order_id);
                    return o ? (
                      <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 text-[10px] text-[#cfe0f5]">
                        <ListOrdered size={11} className="text-[#7db8ff] shrink-0" />
                        <span className="truncate">{o.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"} · {Number(o.amount).toLocaleString("ru-RU")} so'm · ID {o.account_id}</span>
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
                      <div className="flex gap-2">
                        <button onClick={() => confirmEnd(true)} className="flex-1 text-[12px] py-1.5 rounded-lg bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] text-white font-medium">Ha, hal bo'ldi</button>
                        <button onClick={() => confirmEnd(false)} className="flex-1 text-[12px] py-1.5 rounded-lg bg-white/10 text-white font-medium">Yo'q, savolim bor</button>
                      </div>
                    </div>
                  ) : (
                    m.message
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[8px] text-white/50">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {m.sender === "customer" && m.status === "sending" && <Loader2 size={9} className="animate-spin text-white/60" aria-label="Yuborilyapti" />}
                    {m.sender === "customer" && m.status === "failed" && <span className="text-[9px] font-bold text-[#FF6B85]" aria-label="Yuborilmadi" title="Yuborilmadi">!</span>}
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
                      <span className="text-[9px] text-[#FF6B85]/70">Yuborilmadi — tanlash uchun bosing</span>
                    )}
                  </div>
                )}
              </div>
              </React.Fragment>
              );
            })
          )}
          <div ref={supportBottomRef} />
        </div>

        {/* Part I: pastga qaytish tugmasi — faqat tepaga scroll qilinganda. */}
        {showScrollDown && (
          <button
            onClick={() => { supportBottomRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollDown(false); }}
            className="fixed right-3 bottom-20 z-[60] w-10 h-10 rounded-full bg-[#0e2038]/90 backdrop-blur border border-white/10 flex items-center justify-center shadow-lg active:scale-95"
            aria-label="Pastga"
          >
            <ChevronDown size={20} className="text-white" />
          </button>
        )}

        {/* Xabar amallari (long-press) — xabar ustida popover (Telegram uslubi).
            Ekranning istalgan joyiga tegsa yopiladi. */}
        {msgMenuFor && msgMenuPos && (
          <div className="fixed inset-0 z-[85]" onClick={() => setMsgMenuFor(null)}>
            <div
              className={`absolute w-40 select-none bg-[#0e2038]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_10px_34px_rgba(0,0,0,0.55)] p-1 ${menuArmed ? "" : "pointer-events-none opacity-95"}`}
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
            Nusxalandi ✓
          </div>
        )}

        {/* Part I: buyurtma orqali kirilganda biriktirilgan karta (faqat old
            tomon — sabab/operator faqat operator panelida ko'rinadi). */}
        {selectedOrder && (
          <div className="px-3 pt-2 shrink-0">
            <div className="rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 flex items-center gap-2">
              <ListOrdered size={15} className="text-[#7db8ff] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">
                  {selectedOrder.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"} · {Number(selectedOrder.amount).toLocaleString("ru-RU")} so'm
                </div>
                <div className="text-[10px] text-[#93a5ba] truncate">{selectedOrder.platform} · ID {selectedOrder.account_id} · {STATUS_LABEL[selectedOrder.status].label}</div>
              </div>
              <button onClick={() => setSelectedOrderId(null)} className="shrink-0 p-1 rounded active:bg-white/10 text-[#93a5ba]" aria-label="Olib tashlash"><XCircle size={14} /></button>
            </div>
          </div>
        )}
        {supportReplyTo && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#0e2038]">
            <Reply size={12} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0 text-[11px] text-[#93a5ba] truncate">
              {supportReplyTo.message || (supportReplyTo.image_path ? "📷 Rasm" : supportReplyTo.voice_path ? "🎤 Ovozli xabar" : "")}
            </div>
            <button onClick={() => { setSupportReplyTo(null); setSupportError(""); }} className="shrink-0 p-1 rounded active:bg-white/10 text-[#93a5ba]">
              <XCircle size={13} />
            </button>
          </div>
        )}
        {supportError && (
          <p className="px-4 py-1.5 text-[11px] text-[#FF6B85] bg-[#0e2038]">{supportError}</p>
        )}
        {/* Support chatda ovoz YO'Q — faqat rasm/fayl + matn. */}
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <label className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] cursor-pointer">
            <Paperclip size={14} className="text-[#7db8ff]" />
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={sendSupportImage} disabled={supportSending} />
          </label>
          <input
            ref={supportInputRef}
            className="flex-1 min-w-0 bg-[#0e2038] rounded-lg py-2 px-3 text-[12.5px] text-white outline-none placeholder:text-[#5b7089]"
            placeholder="Xabar yozing..."
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

  // menu
  return (
    <div className={`${bgCls} p-5 relative`}>
      <FloatingAmbience />
      <div className="relative z-10">
      <div className="rounded-2xl bg-gradient-to-br from-[#123f77] to-[#0e2038] p-5 mb-5 shadow-[7px_7px_18px_rgba(0,0,0,0.45),-4px_-4px_14px_rgba(120,180,255,0.1)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-[#93a5ba] mb-1">Xush kelibsiz</p>
            <p className="text-[20px] font-extrabold" style={titleShadow}>{customer?.full_name || customer?.phone}</p>
          </div>
          <button onClick={logout} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.08] text-[11px] text-[#93a5ba] active:bg-white/[0.14]" aria-label="Chiqish">
            <LogOut size={13} /> Chiqish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <button onClick={() => { setError(""); setScreen("topup"); }} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3D7FFF] to-[#2456c9] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Download size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">Hisob to'ldirish</div>
        </button>
        <button onClick={() => { setError(""); setScreen("withdraw"); }} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4C76A] to-[#c99a3e] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <ArrowUpFromLine size={17} className="text-[#2a1e05]" />
          </div>
          <div className="text-[13px] font-bold">Pul yechish</div>
        </button>
        <button onClick={openOrders} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4ADE80] to-[#22a355] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <ListOrdered size={17} className="text-[#06170e]" />
          </div>
          <div className="text-[13px] font-bold">Buyurtmalarim</div>
        </button>
        <button onClick={() => openSupport()} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f2d9c] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Headset size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">Operator bilan aloqa</div>
        </button>
      </div>
      </div>
    </div>
  );
}
