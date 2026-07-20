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

const inputCls =
  "w-full bg-[#0e2038] rounded-xl py-3.5 px-4 text-[14px] text-white outline-none placeholder:text-[#5b7089] " +
  "shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(120,180,255,0.06)] " +
  "focus:shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(120,180,255,0.12),0_0_0_2px_rgba(61,127,255,0.4)] transition-shadow";

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

  const bgCls = "min-h-screen bg-gradient-to-b from-[#123f77] via-[#0f3364] to-[#0a1a30] text-white";

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
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3D7FFF] to-[#7c3aed] flex items-center justify-center text-[28px]
                         shadow-[7px_7px_18px_rgba(0,0,0,0.5),-4px_-4px_14px_rgba(120,180,255,0.2)]"
            >
              ⬡
            </div>
          </div>

          <h1
            className="text-[30px] font-black text-center mb-1 bg-gradient-to-r from-[#7db8ff] via-white to-[#F4C76A] bg-clip-text text-transparent"
            style={titleShadow}
          >
            BetCore Pay
          </h1>
          <p className="text-[13px] text-[#93a5ba] text-center mb-7">
            {mode === "login" ? "Hisobingizga kiring" : "Yangi hisob yarating"}
          </p>

          <form onSubmit={submit} className="space-y-3.5">
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

          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="w-full text-center mt-5 text-[13px] text-[#93a5ba]"
          >
            {mode === "login" ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting" : "Hisobingiz bormi? Kiring"}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "placeholder") {
    return (
      <div className={`${bgCls} p-6 flex flex-col items-center justify-center text-center`}>
        <p className="text-[14px] text-[#93a5ba] mb-6">{placeholderText}</p>
        <button onClick={() => setScreen("menu")} className={`${buttonCls} max-w-[200px]`}>
          Orqaga
        </button>
      </div>
    );
  }

  return (
    <div className={`${bgCls} p-5`}>
      <div
        className="rounded-2xl bg-gradient-to-br from-[#123f77] to-[#0e2038] p-5 mb-5
                   shadow-[7px_7px_18px_rgba(0,0,0,0.45),-4px_-4px_14px_rgba(120,180,255,0.1)]"
      >
        <p className="text-[11px] text-[#93a5ba] mb-1">Xush kelibsiz</p>
        <p className="text-[20px] font-extrabold" style={titleShadow}>{customer?.full_name || customer?.phone}</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <button onClick={() => openPlaceholder("Hisob to'ldirish")} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3D7FFF] to-[#2456c9] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Download size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">Hisob to'ldirish</div>
        </button>
        <button onClick={() => openPlaceholder("Pul yechish")} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F4C76A] to-[#c99a3e] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <ArrowUpFromLine size={17} className="text-[#2a1e05]" />
          </div>
          <div className="text-[13px] font-bold">Pul yechish</div>
        </button>
        <button onClick={() => openPlaceholder("Buyurtmalarim")} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4ADE80] to-[#22a355] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <ListOrdered size={17} className="text-[#06170e]" />
          </div>
          <div className="text-[13px] font-bold">Buyurtmalarim</div>
        </button>
        <button onClick={() => openPlaceholder("Operator bilan aloqa")} className={menuCardCls}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f2d9c] flex items-center justify-center mb-3 shadow-[3px_3px_8px_rgba(0,0,0,0.4)]">
            <Headset size={17} className="text-white" />
          </div>
          <div className="text-[13px] font-bold">Operator bilan aloqa</div>
        </button>
      </div>
    </div>
  );
}
