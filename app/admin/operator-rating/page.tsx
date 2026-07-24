"use client";

import React, { useEffect, useState } from "react";
import { Gauge, Loader2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

type Operator = { id: string; name: string; rating: number; is_online: boolean; is_busy: boolean };
type Event = { id: string; operator_name: string; delta: number; reason: string | null; created_at: string };
type Alert = { id: string; operator_name: string; level: number; reason: string | null; created_at: string };

const fmtDt = (s: string) => new Date(s).toLocaleString("ru-RU");
const ratingColor = (n: number) => (n > 0 ? "text-[#4ADE80]" : n < 0 ? "text-[#FF6B85]" : "text-white/60");
const levelBadge = (l: number) =>
  l === 3 ? "bg-[#FF6B85]/15 text-[#FF6B85] border-[#FF6B85]/40" : l === 2 ? "bg-[#F4C76A]/15 text-[#F4C76A] border-[#F4C76A]/40" : "bg-white/5 text-white/50 border-white/10";

export default function OperatorRatingPage() {
  const [data, setData] = useState<{ operators: Operator[]; events: Event[]; alerts: Alert[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"events" | "alerts">("events");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/operator-rating");
        const d = await res.json();
        if (res.ok) setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>;
  if (!data) return <div className="p-6 text-white/40 text-sm">Ma'lumot yuklanmadi.</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><Gauge size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">Operator reytingi</h1>
          <p className="text-xs text-white/40">Ishonch bali, alertlar va e'tiborsizlik tarixi</p>
        </div>
      </div>

      {/* Operatorlar reytingi (eng past yuqorида) */}
      <div className="overflow-x-auto border border-white/10 rounded-2xl mb-6">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-xs border-b border-white/10">
            <tr>
              <th className="text-left font-medium px-4 py-3">Operator</th>
              <th className="text-center font-medium px-4 py-3">Holat</th>
              <th className="text-right font-medium px-4 py-3">Reyting</th>
            </tr>
          </thead>
          <tbody>
            {data.operators.map((o) => (
              <tr key={o.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-white">{o.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${o.is_online ? "bg-[#4ADE80]" : "bg-white/30"}`} />
                  {o.is_busy && <span className="text-[11px] text-[#FF6B85]">band</span>}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${ratingColor(o.rating)}`}>{o.rating > 0 ? `+${o.rating}` : o.rating}</td>
              </tr>
            ))}
            {data.operators.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-white/40 text-sm">Operator yo'q.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tarix: hodisalar / alertlar */}
      <div className="flex gap-1.5 mb-3">
        <button onClick={() => setTab("events")} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium ${tab === "events" ? "bg-[#1CE0C3]/20 text-white" : "text-white/50 hover:bg-white/5"}`}>Reyting hodisalari</button>
        <button onClick={() => setTab("alerts")} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium ${tab === "alerts" ? "bg-[#1CE0C3]/20 text-white" : "text-white/50 hover:bg-white/5"}`}>Alertlar</button>
      </div>

      {tab === "events" ? (
        <div className="space-y-1.5">
          {data.events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3.5 py-2.5 text-[12px]">
              <div className="min-w-0">
                <span className="text-white font-medium">{e.operator_name}</span>
                <span className="text-white/40"> · {e.reason || "—"}</span>
              </div>
              <div className={`flex items-center gap-1 shrink-0 font-semibold ${ratingColor(e.delta)}`}>
                {e.delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {e.delta > 0 ? `+${e.delta}` : e.delta}
                <span className="text-white/30 font-normal ml-2">{fmtDt(e.created_at)}</span>
              </div>
            </div>
          ))}
          {data.events.length === 0 && <div className="text-white/40 text-sm text-center py-8">Hodisa yo'q.</div>}
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3.5 py-2.5 text-[12px]">
              <div className="min-w-0 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[10px] ${levelBadge(a.level)}`}>{a.level}-daraja</span>
                <span className="text-white font-medium">{a.operator_name}</span>
                <span className="text-white/40 truncate"> · {a.reason || "—"}</span>
              </div>
              <span className="text-white/30 shrink-0">{fmtDt(a.created_at)}</span>
            </div>
          ))}
          {data.alerts.length === 0 && <div className="text-white/40 text-sm text-center py-8">Alert yo'q.</div>}
        </div>
      )}
    </div>
  );
}
