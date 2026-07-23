"use client";

import React, { useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";

type Order = {
  id: string;
  type: "topup" | "withdraw";
  platform: string;
  account_id: string;
  amount: number;
  payment_method: string;
  status: "pending" | "completed" | "rejected";
  player_name: string | null;
  created_at: string;
  customers: { phone: string; full_name: string | null } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Kutilmoqda", cls: "text-[#F4C76A]" },
  completed: { label: "Bajarildi", cls: "text-[#4ADE80]" },
  rejected: { label: "Rad etildi", cls: "text-[#FF6B85]" },
};
const FILTERS: { id: string; label: string }[] = [
  { id: "pending", label: "Kutilmoqda" },
  { id: "completed", label: "Bajarilgan" },
  { id: "rejected", label: "Rad etilgan" },
  { id: "all", label: "Barchasi" },
];

export default function PartnerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/partner/orders");
        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ListOrdered size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Buyurtmalar</h1>
      </div>
      <p className="text-[13px] text-muted mb-5">Mijozlaringizning hisob to'ldirish/yechish buyurtmalari.</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${filter === f.id ? "bg-accent/20 text-white" : "text-muted hover:text-white hover:bg-white/5"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">Bu holatda buyurtma yo'q.</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => {
            const st = STATUS[o.status] ?? STATUS.pending;
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{o.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"} · {o.platform}</div>
                  <div className="text-[11px] text-muted mt-0.5 truncate">
                    {o.customers?.full_name || o.customers?.phone || "—"} · {o.player_name ? `${o.player_name} (${o.account_id})` : `ID: ${o.account_id}`} · {o.payment_method}
                  </div>
                  <div className="text-[10px] text-[#5b6f85] mt-0.5">{new Date(o.created_at).toLocaleString("ru-RU")}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-bold">{Number(o.amount).toLocaleString("ru-RU")}</div>
                  <div className={`text-[11px] font-medium ${st.cls}`}>{st.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
