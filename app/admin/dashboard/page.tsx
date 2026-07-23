"use client";

import React, { useEffect, useState } from "react";
import { Users, Download, Copy, MousePointerClick, TrendingUp, Wallet, Clock, CheckCircle2, XCircle, Banknote, Headset, UserCog, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "7d", label: "7 kun" },
  { key: "30d", label: "30 kun" },
  { key: "all", label: "Hammasi" },
];
function periodStart(p: Period): string | null {
  if (p === "all") return null;
  const now = new Date();
  if (p === "today") { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  return new Date(now.getTime() - (p === "7d" ? 7 : 30) * 86400000).toISOString();
}
function fmtSom(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} so'm`;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("today");

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-[22px] font-bold">Dashboard</h1>
        <div className="flex gap-1.5 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${period === p.key ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-muted mb-6">Umumiy statistika — tanlangan davr bo'yicha (real ma'lumot).</p>

      <Can permission="telegram_orders.manage">
        <BetCorePayMetrics period={period} />
      </Can>

      <Can permission="telegram_orders.manage">
        <StaffActivity period={period} />
      </Can>

      <WebAnalytics period={period} />

      <Can permission="promotions.manage">
        <AffiliateAnalytics />
      </Can>
    </div>
  );
}

function WebAnalytics({ period }: { period: Period }) {
  const [counts, setCounts] = useState({ views: 0, apk: 0, promo: 0, ads: 0 });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const start = periodStart(period);
      const types = ["page_view", "apk_download", "promo_copy", "ad_click"] as const;
      const results = await Promise.all(
        types.map((t) => {
          let q = supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", t);
          if (start) q = q.gte("created_at", start);
          return q;
        })
      );
      setCounts({
        views: results[0].count ?? 0,
        apk: results[1].count ?? 0,
        promo: results[2].count ?? 0,
        ads: results[3].count ?? 0,
      });
    })();
  }, [period]);

  const cards = [
    { label: "Page Views", value: counts.views, icon: Users },
    { label: "APK Downloads", value: counts.apk, icon: Download },
    { label: "Promo Copies", value: counts.promo, icon: Copy },
    { label: "Ad Clicks", value: counts.ads, icon: MousePointerClick },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-accent" />
        <h2 className="text-[15px] font-bold">Veb-analitika</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 sm:p-5">
            <c.icon size={18} className="text-accent mb-3" />
            <div className="text-[22px] sm:text-[24px] font-bold">{c.value.toLocaleString("ru-RU")}</div>
            <div className="text-[12px] text-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BetCorePayMetrics({ period }: { period: Period }) {
  const [m, setM] = useState({ pending: 0, completed: 0, rejected: 0, volume: 0, topup: 0, withdraw: 0, customers: 0, openSupport: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const start = periodStart(period);

      // Snapshot (davrga bog'liq emas — "hozirgi" holat)
      const pendingQ = supabase.from("telegram_orders").select("id", { count: "exact", head: true }).eq("status", "pending");
      const openQ = supabase.from("telegram_support_threads").select("customer_id", { count: "exact", head: true }).eq("is_archived", false);
      // Davr bo'yicha
      let custQ = supabase.from("customers").select("id", { count: "exact", head: true });
      let ordersQ = supabase.from("telegram_orders").select("type, status, amount").limit(20000);
      if (start) { custQ = custQ.gte("created_at", start); ordersQ = ordersQ.gte("created_at", start); }

      const [pend, open, cust, orders] = await Promise.all([pendingQ, openQ, custQ, ordersQ]);
      let completed = 0, rejected = 0, volume = 0, topup = 0, withdraw = 0;
      for (const o of (orders.data ?? []) as any[]) {
        if (o.status === "completed") { completed++; volume += Number(o.amount || 0); if (o.type === "topup") topup++; else withdraw++; }
        else if (o.status === "rejected") rejected++;
      }
      setM({ pending: pend.count ?? 0, openSupport: open.count ?? 0, customers: cust.count ?? 0, completed, rejected, volume, topup, withdraw });
      setLoading(false);
    })();
  }, [period]);

  const cards = [
    { label: "Kutilayotgan", value: m.pending.toLocaleString("ru-RU"), icon: Clock, color: "#F4C76A" },
    { label: "Bajarilgan", value: m.completed.toLocaleString("ru-RU"), icon: CheckCircle2, color: "#4ADE80" },
    { label: "Rad etilgan", value: m.rejected.toLocaleString("ru-RU"), icon: XCircle, color: "#FF6B85" },
    { label: "Hajm (so'm)", value: fmtSom(m.volume), icon: Banknote, color: "#7db8ff" },
    { label: period === "all" ? "Jami mijozlar" : "Yangi mijozlar", value: m.customers.toLocaleString("ru-RU"), icon: Users, color: "#7db8ff" },
    { label: "Ochiq murojaatlar", value: m.openSupport.toLocaleString("ru-RU"), icon: Headset, color: "#7db8ff" },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Wallet size={16} className="text-accent" />
        <h2 className="text-[15px] font-bold">BetCore Pay — buyurtmalar oqimi</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4 mb-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <c.icon size={17} className="mb-2.5" style={{ color: c.color }} />
            <div className="text-[16px] sm:text-[19px] font-bold leading-tight">{loading ? "…" : c.value}</div>
            <div className="text-[11px] text-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-3">
          <ArrowDownToLine size={18} className="text-[#4ADE80] shrink-0" />
          <div><div className="text-[16px] font-bold">{loading ? "…" : m.topup.toLocaleString("ru-RU")}</div><div className="text-[11px] text-muted">To'ldirish (bajarilgan)</div></div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex items-center gap-3">
          <ArrowUpFromLine size={18} className="text-[#F4C76A] shrink-0" />
          <div><div className="text-[16px] font-bold">{loading ? "…" : m.withdraw.toLocaleString("ru-RU")}</div><div className="text-[11px] text-muted">Yechish (bajarilgan)</div></div>
        </div>
      </div>
    </div>
  );
}

function StaffActivity({ period }: { period: Period }) {
  const [rows, setRows] = useState<{ id: string; name: string; completed: number; volume: number; replies: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const start = periodStart(period);

      let ordersQ = supabase.from("telegram_orders").select("operator_id, amount").eq("status", "completed").limit(20000);
      let msgsQ = supabase.from("telegram_support_messages").select("operator_id").eq("sender", "operator").limit(30000);
      if (start) { ordersQ = ordersQ.gte("created_at", start); msgsQ = msgsQ.gte("created_at", start); }

      const [profRes, ordRes, msgRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, full_name"),
        ordersQ,
        msgsQ,
      ]);
      const nameById = new Map<string, string>();
      for (const p of (profRes.data ?? []) as any[]) nameById.set(p.id, p.display_name || p.full_name || "—");

      const agg = new Map<string, { completed: number; volume: number; replies: number }>();
      const get = (id: string) => { let a = agg.get(id); if (!a) { a = { completed: 0, volume: 0, replies: 0 }; agg.set(id, a); } return a; };
      for (const o of (ordRes.data ?? []) as any[]) if (o.operator_id) { const a = get(o.operator_id); a.completed++; a.volume += Number(o.amount || 0); }
      for (const msg of (msgRes.data ?? []) as any[]) if (msg.operator_id) get(msg.operator_id).replies++;

      setRows(
        Array.from(agg.entries())
          .map(([id, a]) => ({ id, name: nameById.get(id) ?? "—", ...a }))
          .sort((x, y) => y.completed - x.completed || y.replies - x.replies)
      );
      setLoading(false);
    })();
  }, [period]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <UserCog size={16} className="text-accent" />
        <h2 className="text-[15px] font-bold">Xodimlar faoliyati (operatorlar)</h2>
      </div>
      <div className="rounded-xl border border-white/8 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead className="bg-white/[0.03] text-[11px] text-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Operator</th>
              <th className="text-right px-4 py-3 font-medium">Bajarilgan</th>
              <th className="text-right px-4 py-3 font-medium">Hajm</th>
              <th className="text-right px-4 py-3 font-medium">Support javob</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Yuklanmoqda…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Bu davrda faoliyat yo'q.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-right">{r.completed.toLocaleString("ru-RU")}</td>
                <td className="px-4 py-3 text-right text-muted">{fmtSom(r.volume)}</td>
                <td className="px-4 py-3 text-right">{r.replies.toLocaleString("ru-RU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AffiliateAnalytics() {
  const [summary, setSummary] = useState({ total: 0, today: 0, week: 0, month: 0 });
  const [dailySeries, setDailySeries] = useState<{ day: string; clicks: number }[]>([]);
  const [breakdown, setBreakdown] = useState<{ country: Record<string, number>; device: Record<string, number> }>({ country: {}, device: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const monthStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

      const [totalRes, todayRes, weekRes, monthRes, recentRes] = await Promise.all([
        supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
        supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).gte("created_at", weekStart.toISOString()),
        supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
        supabase.from("affiliate_clicks").select("created_at, country, device").gte("created_at", monthStart.toISOString()).limit(5000),
      ]);

      setSummary({ total: totalRes.count ?? 0, today: todayRes.count ?? 0, week: weekRes.count ?? 0, month: monthRes.count ?? 0 });

      // Build a 14-day daily series client-side from the raw rows.
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      const countryCount: Record<string, number> = {};
      const deviceCount: Record<string, number> = {};
      for (const row of recentRes.data ?? []) {
        const day = (row.created_at as string).slice(0, 10);
        if (day in days) days[day] += 1;
        const country = row.country ?? "XX";
        countryCount[country] = (countryCount[country] ?? 0) + 1;
        const device = row.device ?? "unknown";
        deviceCount[device] = (deviceCount[device] ?? 0) + 1;
      }
      setDailySeries(Object.entries(days).map(([day, clicks]) => ({ day: day.slice(5), clicks })));
      setBreakdown({ country: countryCount, device: deviceCount });
      setLoading(false);
    })();
  }, []);

  const topCountries = Object.entries(breakdown.country).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topDevices = Object.entries(breakdown.device).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-accent" />
        <h2 className="text-[16px] font-bold">Affiliate Click Analytics</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {[
          { label: "Jami klik", value: summary.total },
          { label: "Bugun", value: summary.today },
          { label: "So'nggi 7 kun", value: summary.week },
          { label: "So'nggi 30 kun", value: summary.month },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-[20px] font-bold">{c.value}</div>
            <div className="text-[11px] text-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {!loading && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-[12px] text-muted mb-3">Kunlik kliklar (14 kun)</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#5b6f85" }} />
                <YAxis tick={{ fontSize: 10, fill: "#5b6f85" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0D1B2A", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
                <Bar dataKey="clicks" fill="#00A3FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-[12px] text-muted mb-3">Top mamlakatlar</div>
            <div className="space-y-2">
              {topCountries.length === 0 && <p className="text-[11px] text-[#5b6f85]">Ma'lumot yo'q</p>}
              {topCountries.map(([country, count]) => (
                <div key={country} className="flex items-center justify-between text-[12px]">
                  <span>{country}</span>
                  <span className="text-muted">{count}</span>
                </div>
              ))}
            </div>
            <div className="text-[12px] text-muted mt-4 mb-3">Qurilmalar</div>
            <div className="space-y-2">
              {topDevices.map(([device, count]) => (
                <div key={device} className="flex items-center justify-between text-[12px]">
                  <span className="capitalize">{device}</span>
                  <span className="text-muted">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
