"use client";

import React, { useEffect, useState } from "react";
import { Heart, LayoutDashboard, CreditCard, Download, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Tab = "dashboard" | "methods";

export default function DonationsAdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-1">
        <Heart size={20} className="text-cta" />
        <h1 className="text-[22px] font-bold">Donations</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">Homiylik statistikasi va to'lov usullarini boshqarish.</p>

      <div className="flex gap-1 mb-6 border-b border-white/8">
        <button onClick={() => setTab("dashboard")} className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 ${tab === "dashboard" ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"}`}>
          <LayoutDashboard size={14} /> Dashboard
        </button>
        <button onClick={() => setTab("methods")} className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 ${tab === "methods" ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"}`}>
          <CreditCard size={14} /> Payment Methods
        </button>
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "methods" && <PaymentMethodsTab />}
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, month: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [topSupporters, setTopSupporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const monthStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

      const sumSince = async (since?: string) => {
        let query = supabase.from("donations").select("amount").eq("status", "completed");
        if (since) query = query.gte("created_at", since);
        const { data } = await query;
        return (data ?? []).reduce((sum, d: any) => sum + Number(d.amount), 0);
      };

      const [total, today, week, month, { data: recentData }, { data: topData }] = await Promise.all([
        sumSince(), sumSince(todayStart.toISOString()), sumSince(weekStart.toISOString()), sumSince(monthStart.toISOString()),
        supabase.from("donations").select("*, payment_methods(name)").order("created_at", { ascending: false }).limit(10),
        supabase.from("donations").select("donor_name, amount, is_anonymous").eq("status", "completed").order("amount", { ascending: false }).limit(5),
      ]);

      setStats({ total, today, week, month });
      setRecent(recentData ?? []);
      setTopSupporters(topData ?? []);
      setLoading(false);
    })();
  }, []);

  const exportCsv = () => {
    window.location.href = "/api/admin/donations/export";
  };

  if (loading) return <p className="text-[13px] text-muted">Yuklanmoqda…</p>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[12px] font-semibold hover:bg-white/5">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Jami daromad", value: stats.total },
          { label: "Bugun", value: stats.today },
          { label: "So'nggi 7 kun", value: stats.week },
          { label: "So'nggi 30 kun", value: stats.month },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <TrendingUp size={15} className="text-cta mb-2" />
            <div className="text-[20px] font-bold">${c.value.toFixed(2)}</div>
            <div className="text-[11px] text-muted mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-[14px] font-bold mb-3">So'nggi homiyliklar</h2>
          <div className="space-y-2">
            {recent.map((d) => (
              <div key={d.id} className="rounded-lg border border-white/8 p-3 text-[12px] flex items-center justify-between">
                <div>
                  <span className="font-medium">{d.is_anonymous ? "Anonim" : d.donor_name || "—"}</span>
                  <span className="text-muted"> · {d.payment_methods?.name ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    d.status === "completed" ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" :
                    d.status === "pending" ? "bg-vip/10 text-vip border-vip/30" :
                    "bg-white/5 text-muted border-white/10"
                  }`}>{d.status}</span>
                  <span className="font-bold">${Number(d.amount).toFixed(2)}</span>
                </div>
              </div>
            ))}
            {recent.length === 0 && <p className="text-[12px] text-muted">Hozircha homiylik yo'q.</p>}
          </div>
        </div>
        <div>
          <h2 className="text-[14px] font-bold mb-3">Top Supporters</h2>
          <div className="space-y-2">
            {topSupporters.map((s, i) => (
              <div key={i} className="rounded-lg border border-white/8 p-3 text-[12px] flex items-center justify-between">
                <span>{s.is_anonymous ? "Anonim" : s.donor_name || "—"}</span>
                <span className="font-bold">${Number(s.amount).toFixed(2)}</span>
              </div>
            ))}
            {topSupporters.length === 0 && <p className="text-[12px] text-muted">Ma'lumot yo'q.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

type PaymentMethod = {
  id: string; key: string; name: string; method_type: "gateway" | "crypto";
  provider_key: string | null; crypto_symbol: string | null; network: string | null; wallet_address: string | null;
  display_order: number; is_active: boolean;
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const CREDENTIAL_FIELDS: Record<string, { field: string; label: string }[]> = {
  stripe: [{ field: "secret_key", label: "Secret Key" }, { field: "webhook_secret", label: "Webhook Signing Secret" }],
  paypal: [{ field: "client_id", label: "Client ID" }, { field: "client_secret", label: "Client Secret" }, { field: "webhook_id", label: "Webhook ID" }],
  generic: [{ field: "api_key", label: "API Key" }, { field: "api_secret", label: "API Secret (webhook uchun)" }],
};

function PaymentMethodsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialsMethod, setCredentialsMethod] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState({
    name: "", key: "", method_type: "gateway" as "gateway" | "crypto",
    provider_key: "stripe", base_api_url: "", crypto_symbol: "", network: "", wallet_address: "", display_order: 0,
  });
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("payment_methods").select("*").is("deleted_at", null).order("display_order");
    setMethods((data as PaymentMethod[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ name: "", key: "", method_type: "gateway", provider_key: "stripe", base_api_url: "", crypto_symbol: "", network: "", wallet_address: "", display_order: methods.length });
    setEditingId(null); setShowForm(true); setError("");
  };
  const openEdit = (m: PaymentMethod) => {
    setForm({
      name: m.name, key: m.key, method_type: m.method_type, provider_key: m.provider_key ?? "stripe", base_api_url: (m as any).base_api_url ?? "",
      crypto_symbol: m.crypto_symbol ?? "", network: m.network ?? "", wallet_address: m.wallet_address ?? "", display_order: m.display_order,
    });
    setEditingId(m.id); setShowForm(true); setError("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Nom kiriting."); return; }
    if (form.method_type === "crypto" && !form.wallet_address.trim()) { setError("Wallet address kiriting."); return; }
    if (form.method_type === "gateway" && form.provider_key === "generic" && !form.base_api_url.trim()) { setError("Generic provider uchun Base API URL kiriting."); return; }

    const payload: any = {
      name: form.name.trim(), key: form.key.trim() || slugify(form.name), method_type: form.method_type, display_order: Number(form.display_order) || 0,
    };
    if (form.method_type === "gateway") {
      payload.provider_key = form.provider_key; payload.base_api_url = form.provider_key === "generic" ? form.base_api_url.trim() : null;
      payload.crypto_symbol = null; payload.network = null; payload.wallet_address = null;
    } else {
      payload.provider_key = null; payload.base_api_url = null; payload.crypto_symbol = form.crypto_symbol.trim() || null; payload.network = form.network.trim() || null; payload.wallet_address = form.wallet_address.trim();
    }

    const result = editingId
      ? await supabase.from("payment_methods").update(payload).eq("id", editingId)
      : await supabase.from("payment_methods").insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setShowForm(false);
    load();
  };

  const toggleActive = async (m: PaymentMethod) => {
    await supabase.from("payment_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("To'lov usuli o'chirilsinmi?")) return;
    await supabase.from("payment_methods").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };
  const move = async (index: number, direction: -1 | 1) => {
    const target = methods[index + direction];
    if (!target) return;
    const current = methods[index];
    await Promise.all([
      supabase.from("payment_methods").update({ display_order: target.display_order }).eq("id", current.id),
      supabase.from("payment_methods").update({ display_order: current.display_order }).eq("id", target.id),
    ]);
    load();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          Add Payment Method
        </button>
      </div>

      <div className="space-y-2">
        {methods.map((m, i) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/8 p-3">
            <div className="text-[13px]">
              <span className="font-medium">{m.name}</span>
              <span className="text-muted ml-2 text-[11px]">
                {m.method_type === "gateway" ? m.provider_key : `${m.crypto_symbol ?? ""} ${m.network ? `(${m.network})` : ""}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-[11px] px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === methods.length - 1} className="text-[11px] px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">↓</button>
              {m.method_type === "gateway" && (
                <button onClick={() => setCredentialsMethod(m)} className="px-2.5 py-1 rounded-md border border-white/10 text-[11px] hover:bg-white/5">Kalitlar</button>
              )}
              <button onClick={() => toggleActive(m)} className={`text-[10px] px-2 py-1 rounded-full border ${m.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-white/10"}`}>{m.is_active ? "Faol" : "Faolsiz"}</button>
              <button onClick={() => openEdit(m)} className="px-2.5 py-1 rounded-md border border-white/10 text-[11px] hover:bg-white/5">Tahrirlash</button>
              <button onClick={() => remove(m.id)} className="px-2.5 py-1 rounded-md border border-white/10 text-[11px] text-[#FF6B85] hover:bg-white/5">O'chirish</button>
            </div>
          </div>
        ))}
        {methods.length === 0 && <p className="text-[12px] text-muted text-center py-8">Hozircha to'lov usuli yo'q.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
          <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-[16px] mb-4">{editingId ? "Tahrirlash" : "Yangi to'lov usuli"}</h2>

            <label className="block text-[12px] text-muted mb-1">Nomi</label>
            <input className={`${inputCls} mb-3`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <label className="block text-[12px] text-muted mb-1">Turi</label>
            <select className={`${inputCls} mb-3`} value={form.method_type} onChange={(e) => setForm({ ...form, method_type: e.target.value as any })}>
              <option value="gateway">To'lov shlyuzi (Stripe/PayPal)</option>
              <option value="crypto">Kripto hamyon</option>
            </select>

            {form.method_type === "gateway" ? (
              <>
                <label className="block text-[12px] text-muted mb-1">Provider</label>
                <select className={`${inputCls} mb-3`} value={form.provider_key} onChange={(e) => setForm({ ...form, provider_key: e.target.value })}>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="generic">Generic (kelajakda)</option>
                </select>
                {form.provider_key === "generic" && (
                  <>
                    <label className="block text-[12px] text-muted mb-1">Base API URL</label>
                    <input className={`${inputCls} mb-3`} value={form.base_api_url} onChange={(e) => setForm({ ...form, base_api_url: e.target.value })} placeholder="https://api.provider.com" />
                  </>
                )}
              </>
            ) : (
              <>
                <label className="block text-[12px] text-muted mb-1">Kripto belgisi (masalan USDT, BTC, ETH, SOL)</label>
                <input className={`${inputCls} mb-3`} value={form.crypto_symbol} onChange={(e) => setForm({ ...form, crypto_symbol: e.target.value })} />
                <label className="block text-[12px] text-muted mb-1">Tarmoq (masalan TRC20, ERC20)</label>
                <input className={`${inputCls} mb-3`} value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} />
                <label className="block text-[12px] text-muted mb-1">Wallet Address</label>
                <input className={`${inputCls} mb-3 font-mono`} value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} />
              </>
            )}

            {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px]">Saqlash</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 rounded-lg border border-white/10 text-[13px]">Bekor qilish</button>
            </div>
          </form>
        </div>
      )}

      {credentialsMethod && (
        <GatewayCredentialsModal method={credentialsMethod} onClose={() => setCredentialsMethod(null)} />
      )}
    </div>
  );
}

function GatewayCredentialsModal({ method, onClose }: { method: PaymentMethod; onClose: () => void }) {
  const fields = CREDENTIAL_FIELDS[method.provider_key ?? ""] ?? [];
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/admin/donations/credentials?paymentMethodId=${method.id}&providerKey=${method.provider_key}`);
    if (res.ok) { const json = await res.json(); setStatuses(json.statuses ?? {}); }
  };
  useEffect(() => { load(); }, [method.id]);

  const save = async (field: string) => {
    if (!values[field]) return;
    setSaving(field);
    await fetch("/api/admin/donations/credentials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethodId: method.id, field, value: values[field] }),
    });
    setValues((prev) => ({ ...prev, [field]: "" }));
    setSaving(null);
    load();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6">
        <h2 className="font-bold text-[16px] mb-1">{method.name} — API kalitlari</h2>
        <p className="text-[11px] text-muted mb-4">Shifrlanib saqlanadi, saqlangandan keyin qayta ko'rsatilmaydi.</p>
        {fields.map((f) => (
          <div key={f.field} className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-[12px] text-muted">{f.label}</label>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statuses[f.field] ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-white/10"}`}>
                {statuses[f.field] ? "Sozlangan" : "Sozlanmagan"}
              </span>
            </div>
            <div className="flex gap-2">
              <input type="password" className={inputCls} value={values[f.field] ?? ""} onChange={(e) => setValues((prev) => ({ ...prev, [f.field]: e.target.value }))} />
              <button onClick={() => save(f.field)} disabled={saving === f.field || !values[f.field]} className="px-4 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[13px] font-semibold disabled:opacity-50 shrink-0">
                {saving === f.field ? "…" : "Saqlash"}
              </button>
            </div>
          </div>
        ))}
        <button onClick={onClose} className="w-full py-2 rounded-lg border border-white/10 text-[13px] mt-2">Yopish</button>
      </div>
    </div>
  );
}
