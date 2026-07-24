"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import React, { useEffect, useState } from "react";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

type Op = {
  id: string; name: string; email: string | null;
  is_online: boolean; is_busy: boolean; rating: number;
  completed: number; rejected: number; volume: number;
  alerts: number; open_debt: number; scans: number;
  last_login: string | null; failed_logins: number; flags: string[];
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
const fmtDt = (s: string | null) => (s ? new Date(s).toLocaleString("ru-RU") : "—");

export default function StaffMonitorPage() {
  const [ops, setOps] = useState<Op[]>([]);
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/staff-monitor");
        const d = await res.json();
        if (res.ok) setOps(d.operators ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><ShieldCheck size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">{t("mon.monTitle")}</h1>
          <p className="text-xs text-white/40">{t("mon.monSubtitle")}</p>
        </div>
      </div>

      {ops.length === 0 ? (
        <div className="text-center py-16 text-white/40 text-sm border border-white/10 rounded-2xl">{t("mon.noOperator")}</div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-2xl">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-white/40 text-xs border-b border-white/10">
              <tr>
                <th className="text-left font-medium px-3 py-3">{t("mon.colOperator")}</th>
                <th className="text-center font-medium px-3 py-3">{t("mon.colStatus")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.colRating")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cDid")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cRejected")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cVolume")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cDebt")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cAlert")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cScan")}</th>
                <th className="text-left font-medium px-3 py-3">{t("mon.cLastLogin")}</th>
                <th className="text-right font-medium px-3 py-3">{t("mon.cFailedLogin")}</th>
                <th className="text-left font-medium px-3 py-3">{t("mon.cSuspicious")}</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => (
                <tr key={o.id} className={`border-b border-white/5 last:border-0 ${o.flags.length ? "bg-[#FF6B85]/[0.04]" : ""}`}>
                  <td className="px-3 py-2.5">
                    <div className="text-white font-medium">{o.name}</div>
                    <div className="text-[10.5px] text-white/35">{o.email ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${o.is_online ? "bg-[#4ADE80]" : "bg-white/25"}`} />
                    {o.is_busy && <span className="text-[10px] text-[#FF6B85] ml-1">{t("mon.busy")}</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold ${o.rating > 0 ? "text-[#4ADE80]" : o.rating < 0 ? "text-[#FF6B85]" : "text-white/60"}`}>{o.rating > 0 ? `+${o.rating}` : o.rating}</td>
                  <td className="px-3 py-2.5 text-right text-[#4ADE80]">{o.completed}</td>
                  <td className="px-3 py-2.5 text-right text-[#FF6B85]">{o.rejected}</td>
                  <td className="px-3 py-2.5 text-right text-white/80">{fmt(o.volume)}</td>
                  <td className={`px-3 py-2.5 text-right ${o.open_debt > 0 ? "text-[#F4C76A]" : "text-white/30"}`}>{o.open_debt > 0 ? fmt(o.open_debt) : "—"}</td>
                  <td className={`px-3 py-2.5 text-right ${o.alerts > 0 ? "text-[#F4C76A]" : "text-white/30"}`}>{o.alerts || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-white/50">{o.scans || "—"}</td>
                  <td className="px-3 py-2.5 text-white/60 text-[12px]">{fmtDt(o.last_login)}</td>
                  <td className={`px-3 py-2.5 text-right ${o.failed_logins >= 5 ? "text-[#FF6B85] font-semibold" : "text-white/40"}`}>{o.failed_logins || "—"}</td>
                  <td className="px-3 py-2.5">
                    {o.flags.length === 0 ? <span className="text-white/25 text-[11px]">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {o.flags.map((f, i) => { const FM: Record<string,string> = { low_rating: "mon.flagLowRating", many_rejects: "mon.flagManyRejects", many_failed: "mon.flagManyFailed", open_debt: "mon.flagOpenDebt" }; return (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B85]/15 text-[#FF6B85] border border-[#FF6B85]/30">
                            <AlertTriangle size={10} />{t(FM[f] as any) || f}
                          </span>
                        ); })}
                      </div>
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
