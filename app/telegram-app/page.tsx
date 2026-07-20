"use client";

import React, { useEffect, useState } from "react";
import {
  Download, ArrowUpFromLine, ListOrdered, Headset, Loader2, ChevronLeft, Send, CheckCircle2, XCircle, Clock, Upload,
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
};

type SupportMessage = { id: string; sender: "customer" | "operator"; message: string; created_at: string };

type PaymentInfo = {
  cardNumber: string; cardHolder: string;
  clickNumber: string; clickHolder: string;
  paymeNumber: string; paymeHolder: string;
  cryptoWallet: string;
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
  "w-full bg-[#0e2038] rounded-xl py-3.5 px-4 text-[14px] text-white outline-none placeholder:text-[#5b7089] " +
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

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <button onClick={onBack} className="p-2 -ml-2 rounded-lg active:bg-white/5" aria-label="Orqaga">
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-[18px] font-bold">{title}</h1>
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
        <div className="rounded-lg bg-white/[0.04] border border-white/10 px-3.5 py-2.5 text-[12px] text-[#c7d5e6] space-y-0.5">
          <div>{detail[value]!.label}: <span className="font-semibold text-white">{detail[value]!.number}</span></div>
          {detail[value]!.holder && <div className="text-[#93a5ba]">Egasi: {detail[value]!.holder}</div>}
        </div>
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

export default function TelegramAppPage() {
  const [screen, setScreen] = useState<Screen>("loading");
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

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Support
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportText, setSupportText] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);

  const getInitData = () => window.Telegram?.WebApp?.initData ?? "";

  useEffect(() => {
    fetch("/api/telegram/miniapp/branding")
      .then((r) => r.json())
      .then((data) => setLogoUrl(data.logoUrl))
      .catch(() => {});
    fetch("/api/telegram/miniapp/payment-info")
      .then((r) => r.json())
      .then((data) => setPaymentInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = async () => {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
      const initData = getInitData();
      if (!initData) {
        setError("Bu ilova faqat Telegram ichida ochilishi kerak.");
        setScreen("auth");
        return;
      }
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
        body: JSON.stringify({ phone: fpPhone.trim(), code: fpCode.trim(), newPassword: fpNewPassword }),
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
      setError("Parol yangilandi — endi yangi parolingiz bilan kiring.");
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
      const res = await fetch("/api/telegram/miniapp/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), type: "topup", platform, accountId: tuAccountId.trim(),
          amount: Number(tuAmount), paymentMethod: tuMethod,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "player_not_found") {
          setError("Bunday hisob ID topilmadi. Platforma va ID raqamini tekshiring.");
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
        setError("Buyurtma yaratildi, lekin chek yuklanmadi. \"Operator bilan aloqa\" orqali chekni yuboring.");
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

  const loadSupport = async () => {
    setSupportLoading(true);
    try {
      const res = await fetch(`/api/telegram/miniapp/support?initData=${encodeURIComponent(getInitData())}`);
      const data = await res.json();
      setSupportMessages(data.messages ?? []);
    } catch {
      setSupportMessages([]);
    } finally {
      setSupportLoading(false);
    }
  };

  const openSupport = async () => {
    setScreen("support");
    await loadSupport();
  };

  const sendSupportMessage = async () => {
    if (!supportText.trim()) return;
    setSupportSending(true);
    try {
      const res = await fetch("/api/telegram/miniapp/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), message: supportText.trim() }),
      });
      if (res.ok) {
        setSupportText("");
        await loadSupport();
      }
    } finally {
      setSupportSending(false);
    }
  };

  if (screen === "loading") {
    return (
      <div className={`${bgCls} flex items-center justify-center`}>
        <Loader2 size={28} className="text-accent animate-spin" />
      </div>
    );
  }

  if (screen === "auth") {
    return (
      <div className={`${bgCls} p-6 flex flex-col justify-center`}>
        <div className="max-w-sm mx-auto w-full">
          <div className="flex justify-center mb-2">
            {logoUrl ? (
              <img src={logoUrl} alt="BetCore Pay" className="w-40 h-40 object-contain drop-shadow-[0_8px_20px_rgba(61,127,255,0.4)]" />
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
            <input className={inputCls} placeholder="Parol" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-[12px] text-[#FF6B85] text-center">{error}</p>}

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
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="w-full text-center mt-5 py-2.5 rounded-lg text-[13px] font-semibold text-[#7db8ff] bg-white/[0.03] border border-[#3D7FFF]/25 active:bg-white/[0.06] transition-colors"
          >
            {mode === "login" ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting →" : "Hisobingiz bormi? Kiring →"}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "forgot-password") {
    return (
      <div className={`${bgCls} p-6 flex flex-col justify-center`}>
        <div className="max-w-sm mx-auto w-full">
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
              <input className={inputCls} placeholder="Yangi parol" type="password" value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)} />
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
      <div className={`${bgCls} p-6 flex flex-col items-center justify-center text-center`}>
        <CheckCircle2 size={48} className="text-[#4ADE80] mb-4" />
        <p className="text-[16px] font-bold mb-1.5">{successLabel} buyurtmangiz qabul qilindi</p>
        <p className="text-[13px] text-[#93a5ba] mb-6">Operator tez orada ko'rib chiqadi. Holatni "Buyurtmalarim" bo'limida kuzatishingiz mumkin.</p>
        <button onClick={() => setScreen("menu")} className={`${buttonCls} max-w-[220px]`}>Menyuga qaytish</button>
      </div>
    );
  }

  if (screen === "topup") {
    return (
      <div className={`${bgCls} p-5`}>
        <ScreenHeader title="Hisob to'ldirish" onBack={() => setScreen("menu")} />
        <form onSubmit={submitTopup}>
          <PlatformField platform={tuPlatform} setPlatform={setTuPlatform} customPlatform={tuCustomPlatform} setCustomPlatform={setTuCustomPlatform} />
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Hisob ID raqami</label>
            <input className={inputCls} placeholder="Masalan: 123456789" value={tuAccountId} onChange={(e) => setTuAccountId(e.target.value)} />
          </div>
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
    );
  }

  if (screen === "withdraw") {
    return (
      <div className={`${bgCls} p-5`}>
        <ScreenHeader title="Pul yechish" onBack={() => setScreen("menu")} />
        <form onSubmit={submitWithdraw}>
          <PlatformField platform={wdPlatform} setPlatform={setWdPlatform} customPlatform={wdCustomPlatform} setCustomPlatform={setWdCustomPlatform} />
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">Hisob ID raqami</label>
            <input className={inputCls} placeholder="Masalan: 123456789" value={wdAccountId} onChange={(e) => setWdAccountId(e.target.value)} />
          </div>
          <div className="mb-3.5">
            <label className="block text-[12px] text-[#93a5ba] mb-1.5">4 xonali pul yechish kodi</label>
            <input className={inputCls} placeholder="Masalan: 1234" value={wdCode} onChange={(e) => setWdCode(e.target.value)} inputMode="numeric" />
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
    );
  }

  if (screen === "orders") {
    return (
      <div className={`${bgCls} p-5`}>
        <ScreenHeader title="Buyurtmalarim" onBack={() => setScreen("menu")} />
        {ordersLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-accent" /></div>
        ) : orders.length === 0 ? (
          <p className="text-[13px] text-[#93a5ba] text-center mt-8">Hozircha buyurtmalar yo'q.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (screen === "support") {
    return (
      <div className={`${bgCls} flex flex-col h-screen`}>
        <div className="p-5 pb-3">
          <ScreenHeader title="Operator bilan aloqa" onBack={() => setScreen("menu")} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 space-y-3">
          {supportLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-accent" /></div>
          ) : supportMessages.length === 0 ? (
            <p className="text-[13px] text-[#93a5ba] text-center mt-8">Savolingiz bo'lsa, quyidan yozing — operator tez orada javob beradi.</p>
          ) : (
            supportMessages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                    m.sender === "customer" ? "bg-gradient-to-br from-[#3D7FFF] to-[#2456c9]" : "bg-white/[0.06]"
                  }`}
                >
                  {m.message}
                  <div className="text-[9px] text-white/50 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2 p-4">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Xabar yozing..."
            value={supportText}
            onChange={(e) => setSupportText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendSupportMessage()}
          />
          <button onClick={sendSupportMessage} disabled={supportSending || !supportText.trim()} className="shrink-0 px-4 rounded-xl bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] disabled:opacity-50">
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  // menu
  return (
    <div className={`${bgCls} p-5`}>
      <div className="rounded-2xl bg-gradient-to-br from-[#123f77] to-[#0e2038] p-5 mb-5 shadow-[7px_7px_18px_rgba(0,0,0,0.45),-4px_-4px_14px_rgba(120,180,255,0.1)]">
        <p className="text-[11px] text-[#93a5ba] mb-1">Xush kelibsiz</p>
        <p className="text-[20px] font-extrabold" style={titleShadow}>{customer?.full_name || customer?.phone}</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <button onClick={() => setScreen("topup")} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3D7FFF] to-[#2456c9] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Download size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">Hisob to'ldirish</div>
        </button>
        <button onClick={() => setScreen("withdraw")} className={menuCardCls}>
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
        <button onClick={openSupport} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f2d9c] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Headset size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">Operator bilan aloqa</div>
        </button>
      </div>
    </div>
  );
}
