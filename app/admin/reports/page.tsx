"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, ArrowDownToLine, ArrowUpFromLine, Percent, Gift, Banknote, Download, Loader2, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Metrics = {
  topupVolume: number; withdrawVolume: number;
  topupCommission: number; withdrawCommission: number; totalCommission: number;
  bonusSpend: number; netProfit: number;
  completedCount: number; rejectedCount: number; pendingCount: number;
};
type Report = {
  commissionPct: { topup: number; withdraw: number };
  current: Metrics; previous: Metrics;
  partnerRows: { name: string; topupVol: number; withdrawVol: number; count: number; commission: number }[];
  paymentRows: { method: string; topupVol: number; withdrawVol: number; count: number }[];
  operatorRows: { name: string; count: number; vol: number }[];
  daily: { day: string; topup_vol: number; withdraw_vol: number }[];
};

const PRESETS: { id: string; label: string; days: number }[] = [
  { id: "day", label: "Kunlik", days: 1 },
  { id: "week", label: "Haftalik", days: 7 },
  { id: "month", label: "Oylik", days: 30 },
  { id: "year", label: "Yillik", days: 365 },
];
const som = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} so'm`;

function Growth({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return cur > 0 ? <span className="text-[11px] text-[#4ADE80]">yangi</span> : <span className="text-[11px] text-muted">—</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] ${up ? "text-[#4ADE80]" : "text-[#FF6B85]"}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export default function ReportsManager() {
  const [preset, setPreset] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      const s = new Date(customFrom + "T00:00:00");
      const e = new Date(customTo + "T00:00:00"); e.setDate(e.getDate() + 1);
      return { start: s.toISOString(), end: e.toISOString() };
    }
    const days = PRESETS.find((p) => p.id === preset)?.days ?? 30;
    const e = new Date();
    const s = new Date(e.getTime() - days * 86400000);
    return { start: s.toISOString(), end: e.toISOString() };
  }, [preset, customFrom, customTo]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`);
      const d = await res.json();
      if (res.ok) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.start, range.end]);

  const exportCsv = () => {
    if (!data) return;
    const c = data.current;
    const lines: string[] = [];
    lines.push("Ko'rsatkich,Qiymat");
    lines.push(`Umumiy kirim,${Math.round(c.topupVolume)}`);
    lines.push(`Umumiy chiqim,${Math.round(c.withdrawVolume)}`);
    lines.push(`Komissiya (to'ldirish ${data.commissionPct.topup}%),${Math.round(c.topupCommission)}`);
    lines.push(`Komissiya (yechish ${data.commissionPct.withdraw}%),${Math.round(c.withdrawCommission)}`);
    lines.push(`Komissiya jami,${Math.round(c.totalCommission)}`);
    lines.push(`Bonus sarf,${Math.round(c.bonusSpend)}`);
    lines.push(`Sof foyda,${Math.round(c.netProfit)}`);
    lines.push(`Bajarilgan,${c.completedCount}`);
    lines.push(`Rad etilgan,${c.rejectedCount}`);
    lines.push(`Kutilayotgan,${c.pendingCount}`);
    lines.push("");
    lines.push("Hamkor,Kirim,Chiqim,Buyurtma,Komissiya");
    for (const p of data.partnerRows) lines.push(`${p.name},${Math.round(p.topupVol)},${Math.round(p.withdrawVol)},${p.count},${Math.round(p.commission)}`);
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `moliyaviy-hisobot-${preset}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const c = data?.current;
  const p = data?.previous;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-accent" />
          <h1 className="text-[22px] font-bold">Moliyaviy hisobot</h1>
        </div>
        <button onClick={exportCsv} disabled={!data} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[12.5px] font-medium hover:bg-white/[0.08] disabled:opacity-40">
          <Download size={14} /> CSV yuklab olish
        </button>
      </div>
      <p className="text-[13px] text-muted mb-5">Butun tizim moliyasi. Komissiya: to'ldirish {data?.commissionPct.topup ?? 8}% / yechish {data?.commissionPct.withdraw ?? 2}% (sozlamalardan).</p>

      {/* Davr */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        {PRESETS.map((pr) => (
          <button key={pr.id} onClick={() => setPreset(pr.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${preset === pr.id ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}>
            {pr.label}
          </button>
        ))}
        <button onClick={() => setPreset("custom")} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${preset === "custom" ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}>Ixtiyoriy</button>
        {preset === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px]" />
            <span className="text-muted text-[12px]">—</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px]" />
          </>
        )}
      </div>

      {loading || !c || !p ? (
        <div className="py-16 text-center"><Loader2 size={22} className="animate-spin text-muted mx-auto" /></div>
      ) : (
        <>
          {/* Asosiy kartalar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {[
              { label: "Umumiy kirim", val: som(c.topupVolume), icon: ArrowDownToLine, color: "#4ADE80", cur: c.topupVolume, prev: p.topupVolume },
              { label: "Umumiy chiqim", val: som(c.withdrawVolume), icon: ArrowUpFromLine, color: "#F4C76A", cur: c.withdrawVolume, prev: p.withdrawVolume },
              { label: "Komissiya daromadi", val: som(c.totalCommission), icon: Percent, color: "#7db8ff", cur: c.totalCommission, prev: p.totalCommission },
              { label: "Sof foyda", val: som(c.netProfit), icon: Banknote, color: "#4ADE80", cur: c.netProfit, prev: p.netProfit },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <k.icon size={17} className="mb-2.5" style={{ color: k.color }} />
                <div className="text-[17px] sm:text-[19px] font-bold leading-tight">{k.val}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-muted">{k.label}</span>
                  <Growth cur={k.cur} prev={k.prev} />
                </div>
              </div>
            ))}
          </div>

          {/* Komissiya breakdown + bonus + orderlar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Komissiya tafsiloti</div>
              <div className="flex justify-between text-[13px] mb-1"><span className="text-muted">To'ldirish ({data.commissionPct.topup}%)</span><span className="font-semibold">{som(c.topupCommission)}</span></div>
              <div className="flex justify-between text-[13px] mb-1"><span className="text-muted">Yechish ({data.commissionPct.withdraw}%)</span><span className="font-semibold">{som(c.withdrawCommission)}</span></div>
              <div className="flex justify-between text-[13px] pt-1 border-t border-white/8"><span className="font-medium">Jami</span><span className="font-bold text-[#7db8ff]">{som(c.totalCommission)}</span></div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Bonus sarf</div>
              <div className="flex items-center gap-2 text-[15px] font-bold"><Gift size={16} className="text-[#F4C76A]" /> {som(c.bonusSpend)}</div>
              <div className="text-[11px] text-muted mt-1.5">Bonus tizimi hali yo'q — keyingi bosqichda ulanadi.</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Buyurtmalar</div>
              <div className="flex justify-between text-[13px] mb-1"><span className="text-muted">Bajarilgan</span><span className="font-semibold text-[#4ADE80]">{c.completedCount}</span></div>
              <div className="flex justify-between text-[13px] mb-1"><span className="text-muted">Kutilayotgan</span><span className="font-semibold text-[#F4C76A]">{c.pendingCount}</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-muted">Rad etilgan</span><span className="font-semibold text-[#FF6B85]">{c.rejectedCount}</span></div>
            </div>
          </div>

          {/* Grafik */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-6">
            <div className="text-[13px] font-bold mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-accent" /> Kirim va chiqim (kunlik)</div>
            {data.daily.length === 0 ? (
              <p className="text-[12px] text-muted text-center py-8">Bu davrda ma'lumot yo'q.</p>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.daily} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ADE80" stopOpacity={0.4} /><stop offset="100%" stopColor="#4ADE80" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F4C76A" stopOpacity={0.4} /><stop offset="100%" stopColor="#F4C76A" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" tick={{ fill: "#5b6f85", fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                    <YAxis tick={{ fill: "#5b6f85", fontSize: 10 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v)} width={38} />
                    <Tooltip contentStyle={{ background: "#0e2038", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }} formatter={(v: any, n: any) => [som(Number(v)), n === "topup_vol" ? "Kirim" : "Chiqim"]} labelStyle={{ color: "#93a5ba" }} />
                    <Area type="monotone" dataKey="topup_vol" stroke="#4ADE80" fill="url(#gIn)" strokeWidth={2} />
                    <Area type="monotone" dataKey="withdraw_vol" stroke="#F4C76A" fill="url(#gOut)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Hamkorlar kesimi */}
          <div className="mb-6">
            <div className="text-[13px] font-bold mb-2">Hamkorlar bo'yicha</div>
            <div className="rounded-xl border border-white/8 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead className="bg-white/[0.03] text-[11px] text-muted uppercase tracking-wide">
                  <tr><th className="text-left px-4 py-3 font-medium">Hamkor</th><th className="text-right px-4 py-3 font-medium">Kirim</th><th className="text-right px-4 py-3 font-medium">Chiqim</th><th className="text-right px-4 py-3 font-medium">Buyurtma</th><th className="text-right px-4 py-3 font-medium">Komissiya</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.partnerRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-5 text-center text-muted">Ma'lumot yo'q.</td></tr>
                  ) : data.partnerRows.map((pr, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium">{pr.name}</td>
                      <td className="px-4 py-3 text-right">{som(pr.topupVol)}</td>
                      <td className="px-4 py-3 text-right">{som(pr.withdrawVol)}</td>
                      <td className="px-4 py-3 text-right">{pr.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#7db8ff]">{som(pr.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* To'lov turi + operatorlar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-[13px] font-bold mb-2">To'lov turi bo'yicha</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
                {data.paymentRows.length === 0 ? <p className="text-[12px] text-muted">Ma'lumot yo'q.</p> : data.paymentRows.map((pm) => (
                  <div key={pm.method} className="flex items-center justify-between text-[13px]">
                    <span className="capitalize">{pm.method}</span>
                    <span className="text-muted">{pm.count} ta · <span className="text-white">{som(pm.topupVol + pm.withdrawVol)}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[13px] font-bold mb-2">Operatorlar bo'yicha</div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
                {data.operatorRows.length === 0 ? <p className="text-[12px] text-muted">Ma'lumot yo'q.</p> : data.operatorRows.map((op, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <span>{op.name}</span>
                    <span className="text-muted">{op.count} ta · <span className="text-white">{som(op.vol)}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
