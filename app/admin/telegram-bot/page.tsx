"use client";

import React, { useEffect, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";

type OperatorRow = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  telegram_region: string | null;
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

function OperatorsTab() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [regionDrafts, setRegionDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, is_active, telegram_region, roles!inner(key)")
      .eq("roles.key", "operator")
      .order("full_name");
    setOperators((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveRegion = async (id: string) => {
    const region = regionDrafts[id];
    if (region === undefined) return;
    await supabase.from("profiles").update({ telegram_region: region }).eq("id", id);
    load();
  };

  const toggleActive = async (op: OperatorRow) => {
    await supabase.from("profiles").update({ is_active: !op.is_active }).eq("id", op.id);
    load();
  };

  return (
    <div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-5 text-[12px] text-muted leading-relaxed">
        Yangi operator qo'shish uchun avval <a href="/admin/users" className="text-accent">Foydalanuvchilar</a> bo'limida
        shaxsning rolini <span className="text-white font-medium">Operator</span> qilib belgilang — u shu ro'yxatda
        avtomatik paydo bo'ladi, so'ng mintaqasini shu yerda kiriting.
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : operators.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          Hozircha Operator rolidagi foydalanuvchi yo'q.
        </div>
      ) : (
        <div className="space-y-3">
          {operators.map((op) => (
            <div key={op.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{op.full_name || "(ism kiritilmagan)"}</div>
                <div className={`text-[11px] mt-0.5 ${op.is_active ? "text-[#4ADE80]" : "text-[#5b6f85]"}`}>
                  {op.is_active ? "Faol" : "O'chirilgan"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-muted shrink-0" />
                <input
                  className={inputCls}
                  placeholder="Mintaqa (masalan: Toshkent)"
                  defaultValue={op.telegram_region ?? ""}
                  onChange={(e) => setRegionDrafts((prev) => ({ ...prev, [op.id]: e.target.value }))}
                />
                <button onClick={() => saveRegion(op.id)} className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                  Saqlash
                </button>
                <button onClick={() => toggleActive(op)} className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                  {op.is_active ? "O'chirish" : "Yoqish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
      Hozircha buyurtmalar yo'q — hisob to'ldirish/yechish oqimi qurilgach, buyurtmalar shu yerda ko'rinadi.
    </div>
  );
}

export default function TelegramBotAdminPage() {
  const [tab, setTab] = useState<"orders" | "operators">("orders");

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">BetCore Pay</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">Telegram Mini App orqali hisob to'ldirish/yechish xizmatini boshqarish.</p>

      <div className="flex gap-2 mb-6 border-b border-white/8">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px ${tab === "orders" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          Buyurtmalar
        </button>
        <Can permission="telegram_operators.manage">
          <button
            onClick={() => setTab("operators")}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 ${tab === "operators" ? "border-accent text-white" : "border-transparent text-muted"}`}
          >
            <UsersIcon size={14} /> Operatorlar
          </button>
        </Can>
      </div>

      {tab === "orders" ? <OrdersTab /> : <Can permission="telegram_operators.manage"><OperatorsTab /></Can>}
    </div>
  );
}
