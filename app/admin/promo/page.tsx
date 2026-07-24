"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Loader2, CreditCard, Save, Crown, X } from "lucide-react";
import { toast } from "@/lib/ui/toast";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Row = { id: string; full_name: string | null; phone: string; volume: number; orders_count: number; is_cash: boolean; has_card: boolean };
type Winner = { id: string; customer_id: string; segment: string; place: number; customers: { full_name: string | null; phone: string } | null };
type Settings = { enabled?: boolean; start?: string | null; end?: string | null; cash_multiplier?: number; prizes?: string[] };

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
const inp = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm outline-none focus:border-accent";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function PromoManagePage() {
  const { t } = useLocale();
  const [ranking, setRanking] = useState<Row[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mult, setMult] = useState("1.5");
  const [prizes, setPrizes] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/admin/promo");
      const d = await res.json();
      if (!res.ok) { toast.error(t("prm.tLoadErr")); return; }
      setRanking(d.ranking ?? []);
      setWinners(d.winners ?? []);
      const s: Settings = d.settings ?? {};
      setEnabled(!!s.enabled);
      setStart(toLocalInput(s.start));
      setEnd(toLocalInput(s.end));
      setMult(String(s.cash_multiplier ?? 1.5));
      setPrizes((s.prizes ?? []).join("\n"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          start: start ? new Date(start).toISOString() : null,
          end: end ? new Date(end).toISOString() : null,
          cash_multiplier: Number(mult) || 1.5,
          prizes: prizes.split("\n").map((x) => x.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) { toast.error(t("prm.tSaveErr")); return; }
      toast.success(t("prm.tSettingsSaved"));
      load();
    } finally {
      setSaving(false);
    }
  };

  const setWinner = async (customerId: string, segment: "cash" | "online", place: number) => {
    const res = await fetch("/api/admin/promo/winner", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", customerId, segment, place }),
    });
    if (!res.ok) { toast.error(t("prm.tFailed")); return; }
    toast.success(t("prm.tWinnerSet", { place }));
    load();
  };
  const removeWinner = async (segment: string, place: number) => {
    const res = await fetch("/api/admin/promo/winner", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", segment, place }),
    });
    if (res.ok) { toast.success(t("prm.tRemoved")); load(); }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>;

  const multN = Number(mult) || 1.5;
  const cash = ranking.filter((r) => r.is_cash);
  const online = ranking.filter((r) => !r.is_cash);
  const winnerFor = (segment: string, place: number) => winners.find((w) => w.segment === segment && w.place === place);

  const RankTable = ({ rows, segment, title, boost }: { rows: Row[]; segment: "cash" | "online"; title: string; boost: boolean }) => (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-2.5 bg-white/[0.03] text-[13px] font-semibold text-white flex items-center gap-2">
        {segment === "cash" ? <CreditCard size={15} className="text-[#F4C76A]" /> : <Trophy size={15} className="text-[#1CE0C3]" />}
        {title} {boost && <span className="text-[10px] text-[#F4C76A]">(×{multN})</span>}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-white/30 text-sm">{t("prm.noInList")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs border-b border-white/10">
              <tr>
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">{t("prm.colMijoz")}</th>
                <th className="text-right px-3 py-2">{t("prm.colActivity")}</th>
                {boost && <th className="text-right px-3 py-2">×{multN}</th>}
                <th className="text-center px-3 py-2">{t("prm.colWinner")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 text-white/50">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                  <td className="px-3 py-2 text-white truncate max-w-[140px]">{r.full_name || r.phone}</td>
                  <td className="px-3 py-2 text-right text-[#4ADE80] font-semibold">{fmt(r.volume)}</td>
                  {boost && <td className="px-3 py-2 text-right text-[#F4C76A]">{fmt(r.volume * multN)}</td>}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3].map((p) => {
                        const w = winnerFor(segment, p);
                        const mine = w?.customer_id === r.id;
                        return (
                          <button
                            key={p}
                            onClick={() => setWinner(r.id, segment, p)}
                            className={`w-6 h-6 rounded-md text-[11px] font-bold ${mine ? "bg-[#F4C76A] text-[#2a1e05]" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                            title={t("prm.placeWin", { place: p })}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#F4C76A]/10 text-[#F4C76A]"><Trophy size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">{t("prm.mgrTitle")}</h1>
          <p className="text-xs text-white/40">{t("prm.mgrSub")}</p>
        </div>
      </div>

      {/* Aksiya sozlash */}
      <div className="rounded-2xl glass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-white">{t("prm.settings")}</h2>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${enabled ? "bg-[#4ADE80]/15 border-[#4ADE80]/40 text-[#4ADE80]" : "bg-[#FF6B85]/10 border-[#FF6B85]/30 text-[#FF6B85]"}`}
          >
            {enabled ? t("prm.on") : t("prm.off")}
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div><span className="block text-[11px] text-white/40 mb-1">{t("prm.start")}</span><input type="datetime-local" className={inp} value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><span className="block text-[11px] text-white/40 mb-1">{t("prm.end")}</span><input type="datetime-local" className={inp} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><span className="block text-[11px] text-white/40 mb-1">{t("prm.cashMult")}</span><input type="number" step="0.1" className={inp} value={mult} onChange={(e) => setMult(e.target.value)} /></div>
          <div><span className="block text-[11px] text-white/40 mb-1">{t("prm.prizes")}</span><textarea rows={2} className={inp} value={prizes} onChange={(e) => setPrizes(e.target.value)} placeholder={t("prm.prizesPh")} /></div>
        </div>
        <button onClick={saveSettings} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-accent/20 text-white hover:bg-accent/30 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t("prm.save")}
        </button>
      </div>

      {/* Tasdiqlangan g'oliblar */}
      {winners.length > 0 && (
        <div className="rounded-2xl border border-[#F4C76A]/25 bg-[#F4C76A]/[0.04] p-4 mb-6">
          <h2 className="text-[13px] font-semibold text-[#F4C76A] flex items-center gap-1.5 mb-2.5"><Crown size={15} /> {t("prm.confirmedWinners")}</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {winners.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 text-[12.5px] bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-white">
                  <span className="text-white/40">{w.segment === "cash" ? t("prm.cash") : t("prm.online")} · {t("prm.placeLabel", { place: w.place })}</span> {w.customers?.full_name || w.customers?.phone || "—"}
                </span>
                <button onClick={() => removeWinner(w.segment, w.place)} className="p-1 rounded hover:bg-white/10 text-white/40"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reytinglar */}
      <div className="grid lg:grid-cols-2 gap-5">
        <RankTable rows={cash} segment="cash" title={t("prm.cashCustomers")} boost={true} />
        <RankTable rows={online} segment="online" title={t("prm.onlineCustomers")} boost={false} />
      </div>
    </div>
  );
}
