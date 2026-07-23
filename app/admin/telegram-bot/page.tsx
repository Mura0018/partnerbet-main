"use client";

import React, { useState } from "react";
import { Wallet, Users as UsersIcon, MessageCircle, CreditCard, Headset, X, ClipboardList } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { ChatTab } from "./_components/ChatTab";
import { OrdersTab } from "./_components/OrdersTab";
import { SupportTab } from "./_components/SupportTab";
import { OperatorsTab } from "./_components/OperatorsTab";
import { MyPaymentMethodsTab } from "./_components/MyPaymentMethodsTab";

type Tab = "orders" | "support" | "operators" | "my-payments";

const TABS: { id: Tab; label: string; icon: any; permission?: string }[] = [
  { id: "orders", label: "Buyurtmalar", icon: ClipboardList },
  { id: "support", label: "Murojaatlar", icon: Headset },
  { id: "operators", label: "Operatorlar", icon: UsersIcon, permission: "telegram_operators.manage" },
  { id: "my-payments", label: "To'lovlarim", icon: CreditCard },
];

export default function TelegramBotAdminPage() {
  const [tab, setTab] = useState<Tab>("orders");
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <style>{`
        @keyframes bcFabPulse { 0%,100% { box-shadow: 0 8px 28px rgba(61,127,255,0.40), 0 0 0 0 rgba(61,127,255,0.45); } 50% { box-shadow: 0 8px 28px rgba(61,127,255,0.40), 0 0 0 12px rgba(61,127,255,0); } }
        @keyframes bcDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes bcFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bcTabPop { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="flex items-center gap-2 mb-1">
        <Wallet size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">BetCore Pay</h1>
      </div>
      <p className="text-[13px] text-muted mb-5">Telegram Mini App orqali hisob to'ldirish/yechish xizmatini boshqarish.</p>

      {/* Ixcham segment tablar */}
      <div className="inline-flex gap-1 p-1 mb-6 max-w-full overflow-x-auto rounded-xl bg-white/[0.03] border border-white/8">
        {TABS.map((t) => {
          const btn = (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-all duration-200 ${
                tab === t.id
                  ? "bg-accent/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          );
          return t.permission ? <Can key={t.id} permission={t.permission}>{btn}</Can> : btn;
        })}
      </div>

      <div key={tab} style={{ animation: "bcTabPop 0.25s ease" }}>
        {tab === "orders" && <OrdersTab />}
        {tab === "support" && <SupportTab />}
        {tab === "operators" && <Can permission="telegram_operators.manage"><OperatorsTab /></Can>}
        {tab === "my-payments" && <MyPaymentMethodsTab />}
      </div>

      {/* Suzuvchi Jamoa chati tugmasi (FAB) */}
      <Can permission="team_chat.use">
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Jamoa chati"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          style={{ animation: "bcFabPulse 2.6s ease-in-out infinite" }}
        >
          <MessageCircle size={22} />
        </button>
      </Can>

      {/* Jamoa chati — yon panel (drawer) */}
      {chatOpen && (
        <Can permission="team_chat.use">
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/50"
              style={{ animation: "bcFadeIn 0.2s ease" }}
              onClick={() => setChatOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute inset-y-0 right-0 w-full sm:w-[440px] bg-bg border-l border-white/10 flex flex-col shadow-2xl"
              style={{ animation: "bcDrawerIn 0.28s cubic-bezier(0.22,1,0.36,1)" }}
            >
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-white/8 shrink-0">
                <MessageCircle size={18} className="text-accent" />
                <h2 className="text-[15px] font-bold flex-1">Jamoa chati</h2>
                <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Yopish">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 min-h-0 p-3">
                <ChatTab />
              </div>
            </div>
          </div>
        </Can>
      )}
    </div>
  );
}
