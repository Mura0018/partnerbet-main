"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";
import { ChatTab } from "./_components/ChatTab";
import { OrdersTab } from "./_components/OrdersTab";
import { SupportTab } from "./_components/SupportTab";
import { OperatorsTab } from "./_components/OperatorsTab";
import { MyPaymentMethodsTab } from "./_components/MyPaymentMethodsTab";

export default function TelegramBotAdminPage() {
  const [tab, setTab] = useState<"orders" | "operators" | "chat" | "support" | "my-payments">("orders");

  if (tab === "chat") {
    return (
      <div className="fixed inset-0 z-40 bg-bg flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8 shrink-0">
          <button onClick={() => setTab("orders")} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10" aria-label="Orqaga">
            <ChevronLeft size={20} />
          </button>
          <MessageCircle size={18} className="text-accent" />
          <h1 className="text-[16px] font-bold">Jamoa chati</h1>
        </div>
        <div className="flex-1 p-4 min-h-0 w-full max-w-4xl mx-auto">
          <Can permission="team_chat.use"><ChatTab /></Can>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">BetCore Pay</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">Telegram Mini App orqali hisob to'ldirish/yechish xizmatini boshqarish.</p>

      <div className="flex gap-2 mb-6 border-b border-white/8 overflow-x-auto">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap ${tab === "orders" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          Buyurtmalar
        </button>
        <button
          onClick={() => setTab("support")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "support" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          <Headset size={14} /> Murojaatlar
        </button>
        <Can permission="telegram_operators.manage">
          <button
            onClick={() => setTab("operators")}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "operators" ? "border-accent text-white" : "border-transparent text-muted"}`}
          >
            <UsersIcon size={14} /> Operatorlar
          </button>
        </Can>
        <Can permission="team_chat.use">
          <button
            onClick={() => setTab("chat")}
            className="px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap border-transparent text-muted"
          >
            <MessageCircle size={14} /> Jamoa chati
          </button>
        </Can>
        <button
          onClick={() => setTab("my-payments")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "my-payments" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          <CreditCard size={14} /> Mening to'lovlarim
        </button>
      </div>

      {tab === "orders" && <OrdersTab />}
      {tab === "support" && <SupportTab />}
      {tab === "operators" && <Can permission="telegram_operators.manage"><OperatorsTab /></Can>}
      {tab === "my-payments" && <MyPaymentMethodsTab />}
    </div>
  );
}
