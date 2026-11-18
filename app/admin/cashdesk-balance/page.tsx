"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSiteTimezone } from "@/lib/site/SiteTimezoneProvider";
import { formatMoney, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/ui/toast";

// 6b — Kassa to'ldiruvchi sahifasi (FAQAT O'QISH). Ma'lumot soatlik cron
// snapshot'laridan; bu sahifa 1xBet API'ni chaqirmaydi. Tahrirlash, kalit
// ko'rish, kassa yaratish yo'q.

type Row = {
  id: string;
  name: string;
  region: string | null;
  threshold: number | null;
  checkedAt: string | null;
  lastCheckOk: boolean | null;
  balance: number | null;
  balanceAt: string | null;
  isLow: boolean;
};
type Resp = { scope: "manager" | "all" | "assigned"; assignedCount: number; inactiveAssigned: number; desks: Row[] };

export default function CashdeskBalancePage() {
  const { t } = useLocale();
  const tz = useSiteTimezone();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cashdesk-balance/list", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) { toast.error(t("cbal.loadErr")); return; }
      setData(json as Resp);
    } catch {
      toast.error(t("cbal.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const money = (n: number | null) => (n == null ? "—" : `${formatMoney(n)} ${t("common.som")}`);
  const when = (v: string | null) => (v ? formatDateTime(v, { timeZone: tz }) : "—");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><Coins size={20} /></span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white">{t("cbal.title")}</h1>
            <p className="text-xs text-white/40">{t("cbal.subtitle")}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-50 shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {t("cbal.refresh")}
        </button>
      </div>

      {data && data.scope !== "manager" && (
        <div className="flex items-start gap-2 mb-4 px-3.5 py-2.5 rounded-xl border border-subtle bg-white/[0.03] text-[13px] text-white/70">
          <Info size={15} className="mt-0.5 shrink-0 text-[#1CE0C3]" />
          <span>{data.scope === "all" ? t("cbal.scopeAll") : t("cbal.scopeSome", { n: data.assignedCount })}</span>
        </div>
      )}

      {data && data.inactiveAssigned > 0 && (
        <div className="flex items-start gap-2 mb-4 px-3.5 py-2.5 rounded-xl border border-[#FFB020]/30 bg-[#FFB020]/10 text-[13px] text-[#FFB020]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{t("cbal.assignedInactive")}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>
      ) : !data || data.desks.length === 0 ? (
        data && data.inactiveAssigned > 0 ? null : (
          <div className="text-center py-16 text-white/40 text-sm border border-subtle rounded-2xl">{t("cbal.empty")}</div>
        )
      ) : (
        <div className="overflow-x-auto border border-subtle rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs border-b border-subtle">
              <tr>
                <th className="text-left font-medium px-4 py-3">{t("cbal.hName")}</th>
                <th className="text-left font-medium px-4 py-3">{t("cbal.hRegion")}</th>
                <th className="text-right font-medium px-4 py-3">{t("cbal.hBalance")}</th>
                <th className="text-right font-medium px-4 py-3">{t("cbal.hThreshold")}</th>
                <th className="text-left font-medium px-4 py-3">{t("cbal.hChecked")}</th>
                <th className="text-center font-medium px-4 py-3">{t("cbal.hStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {data.desks.map((d) => (
                <tr key={d.id} className="border-b border-subtle last:border-0">
                  <td className="px-4 py-3 text-white font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-white/60">{d.region || "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`font-medium ${d.balance == null ? "text-white/30" : d.isLow ? "text-[#FF6B85]" : "text-[#4ADE80]"}`}>
                      {money(d.balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white/50 whitespace-nowrap">{money(d.threshold)}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {d.checkedAt == null ? (
                      <span className="text-white/30">{t("cbal.noData")}</span>
                    ) : (
                      <div>
                        <div className="whitespace-nowrap">{when(d.checkedAt)}</div>
                        {d.lastCheckOk === false && (
                          <div className="text-[#FFB020]">
                            {t("cbal.checkFailed")}
                            {d.balanceAt && <span className="text-white/40"> · {t("cbal.lastGood", { time: when(d.balanceAt) })}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.threshold == null ? (
                      // Chegara yo'q -> "past" nishoni HECH QACHON chiqmaydi.
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 whitespace-nowrap">{t("cbal.noThreshold")}</span>
                    ) : d.balance == null ? (
                      <span className="text-white/30 text-xs">—</span>
                    ) : d.isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FF6B85]/10 text-[#FF6B85]">
                        <AlertTriangle size={12} /> {t("cbal.low")}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[#4ADE80]/10 text-[#4ADE80]">{t("cbal.okStatus")}</span>
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
