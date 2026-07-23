"use client";

import React, { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Invoice = { id: string; period: string; model: string; amount: number; currency: string; status: string; created_at: string };

function fmt(n: number, c: string) { return `${Math.round(n).toLocaleString("ru-RU")} ${c}`; }

export default function PartnerBillingPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("partner_invoices").select("id, period, model, amount, currency, status, created_at").order("period", { ascending: false });
      setInvoices((data as Invoice[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const unpaidSum = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0);
  const cur = invoices[0]?.currency ?? "UZS";

  if (loading) return <div className="p-6 text-[13px] text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Hisob</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">Obuna/komissiya to'lovlaringiz.</p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-1">To'lanmagan</div>
          <div className="text-[18px] font-bold text-[#F4C76A]">{fmt(unpaidSum, cur)}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-1">Invoyslar</div>
          <div className="text-[18px] font-bold">{invoices.length}</div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">Hozircha to'lov yozuvi yo'q.</div>
      ) : (
        <div className="space-y-2.5">
          {invoices.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div>
                <div className="text-[13px] font-semibold">{i.period} · {i.model === "commission" ? "Komissiya" : "Obuna"}</div>
                <div className="text-[11px] text-muted">{new Date(i.created_at).toLocaleDateString("ru-RU")}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold">{fmt(i.amount, i.currency)}</div>
                <span className={`text-[11px] font-medium ${i.status === "paid" ? "text-[#4ADE80]" : "text-[#F4C76A]"}`}>{i.status === "paid" ? "To'langan" : "To'lanmagan"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
