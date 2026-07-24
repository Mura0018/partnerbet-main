"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Loader2, CreditCard } from "lucide-react";

type Row = {
  id: string;
  full_name: string | null;
  phone: string;
  volume: number;
  orders_count: number;
  has_card: boolean;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");

export default function PromoRankingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/promo");
        const d = await res.json();
        if (res.ok) setRows(d.ranking ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="p-2 rounded-xl bg-[#F4C76A]/10 text-[#F4C76A]"><Trophy size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">Sovrinli karta — faollik reytingi</h1>
          <p className="text-xs text-white/40">Bajarilgan buyurtmalar summasi bo'yicha (eng faol yuqorida)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-white/40 text-sm border border-white/10 rounded-2xl mt-5">
          Hozircha faol mijoz yo'q (bajarilgan buyurtma bo'lganда ko'rinadi).
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-2xl mt-5">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs border-b border-white/10">
              <tr>
                <th className="text-left font-medium px-4 py-3 w-10">#</th>
                <th className="text-left font-medium px-4 py-3">Mijoz</th>
                <th className="text-right font-medium px-4 py-3">Faollik (so'm)</th>
                <th className="text-right font-medium px-4 py-3">Buyurtma</th>
                <th className="text-center font-medium px-4 py-3">Karta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/50">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="px-4 py-3 text-white">{r.full_name || r.phone}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#4ADE80]">{fmt(r.volume)}</td>
                  <td className="px-4 py-3 text-right text-white/60">{r.orders_count}</td>
                  <td className="px-4 py-3 text-center">
                    {r.has_card ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#1CE0C3]"><CreditCard size={13} /> Olgan</span>
                    ) : (
                      <span className="text-[11px] text-white/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
