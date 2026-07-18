"use client";

import React, { useEffect, useState } from "react";
import { Users, Download, Copy, MousePointerClick, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";

export default function Dashboard() {
  const [counts, setCounts] = useState({ views: 0, apk: 0, promo: 0, ads: 0 });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const types = ["page_view", "apk_download", "promo_copy", "ad_click"] as const;
      const results = await Promise.all(
        types.map((t) =>
          supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", t)
        )
      );
      setCounts({
        views: results[0].count ?? 0,
        apk: results[1].count ?? 0,
        promo: results[2].count ?? 0,
        ads: results[3].count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Page Views", value: counts.views, icon: Users },
    { label: "APK Downloads", value: counts.apk, icon: Download },
    { label: "Promo Copies", value: counts.promo, icon: Copy },
    { label: "Ad Clicks", value: counts.ads, icon: MousePointerClick },
  ];

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold mb-1">Dashboard</h1>
      <p className="text-[13px] text-muted mb-6">Umumiy statistika.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <c.icon size={18} className="text-accent mb-3" />
            <div className="text-[24px] font-bold">{c.value}</div>
            <div className="text-[12px] text-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <Can permission="promotions.manage">
        <AffiliateAnalytics />
      </Can>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
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
