"use client";

import React, { useEffect, useState } from "react";
import { Download, ArrowUpFromLine, ListOrdered, Headset, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Telegram?: { WebApp: any };
  }
}

type Customer = { id: string; full_name: string | null; phone: string };
type Screen = "loading" | "auth" | "menu" | "placeholder";

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-[14px] text-white outline-none focus:border-accent";

export default function TelegramAppPage() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [placeholderText, setPlaceholderText] = useState("");

  const getInitData = () => window.Telegram?.WebApp?.initData ?? "";

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

  const submit = async (e: React.FormEvent) => {
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

  const openPlaceholder = (label: string) => {
    setPlaceholderText(`${label} bo'limi tez orada ishga tushadi.`);
    setScreen("placeholder");
  };

  if (screen === "loading") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="text-accent animate-spin" />
      </div>
    );
  }

  if (screen === "auth") {
    return (
      <div className="min-h-screen bg-bg text-white p-6 flex flex-col justify-center">
        <div className="max-w-sm mx-auto w-full">
          <h1 className="text-[22px] font-bold mb-1">BetCore Pay</h1>
          <p className="text-[13px] text-muted mb-6">
            {mode === "login" ? "Hisobingizga kiring" : "Yangi hisob yarating"}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input className={inputCls} placeholder="Ism-familiya (ixtiyoriy)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            )}
            <input className={inputCls} placeholder="Telefon raqami" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <input className={inputCls} placeholder="Parol" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="w-full text-center mt-4 text-[13px] text-muted hover:text-white"
          >
            {mode === "login" ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting" : "Hisobingiz bormi? Kiring"}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "placeholder") {
    return (
      <div className="min-h-screen bg-bg text-white p-6 flex flex-col items-center justify-center text-center">
        <p className="text-[14px] text-muted mb-6">{placeholderText}</p>
        <button onClick={() => setScreen("menu")} className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px]">
          Orqaga
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-white p-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-5">
        <p className="text-[11px] text-muted mb-1">Xush kelibsiz</p>
        <p className="text-[18px] font-bold">{customer?.full_name || customer?.phone}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => openPlaceholder("Hisob to'ldirish")} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center mb-3"><Download size={16} /></div>
          <div className="text-[13px] font-semibold">Hisob to'ldirish</div>
        </button>
        <button onClick={() => openPlaceholder("Pul yechish")} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
          <div className="w-9 h-9 rounded-xl bg-[#F4C76A]/15 text-[#F4C76A] flex items-center justify-center mb-3"><ArrowUpFromLine size={16} /></div>
          <div className="text-[13px] font-semibold">Pul yechish</div>
        </button>
        <button onClick={() => openPlaceholder("Buyurtmalarim")} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
          <div className="w-9 h-9 rounded-xl bg-[#4ADE80]/15 text-[#4ADE80] flex items-center justify-center mb-3"><ListOrdered size={16} /></div>
          <div className="text-[13px] font-semibold">Buyurtmalarim</div>
        </button>
        <button onClick={() => openPlaceholder("Operator bilan aloqa")} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
          <div className="w-9 h-9 rounded-xl bg-white/10 text-muted flex items-center justify-center mb-3"><Headset size={16} /></div>
          <div className="text-[13px] font-semibold">Operator bilan aloqa</div>
        </button>
      </div>
    </div>
  );
}
