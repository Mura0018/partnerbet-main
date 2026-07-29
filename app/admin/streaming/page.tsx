"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import React, { useEffect, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Radio, Zap, CheckCircle2, XCircle, HelpCircle, Loader2, KeyRound, ListVideo,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { isValidHttpUrl } from "@/lib/validation/url";
import { toast } from "@/lib/ui/toast";
import { Select } from "@/lib/ui/Select";

const inputCls = "w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Provider = {
  id: string;
  key: string;
  name: string;
  base_api_url: string;
  priority: number;
  is_active: boolean;
  connection_status: "unknown" | "connected" | "error";
  last_sync_at: string | null;
  last_error: string | null;
};

type Tab = "providers" | "matches";

export default function StreamingAdminPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("providers");
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <Radio size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">{t("strm.title")}</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">
        Faqat rasmiy, litsenziyalangan oqim (stream) provayderlarini qo'shing. Ruxsatsiz manbalar taqiqlanadi.
      </p>

      <div className="flex gap-1 mb-6 border-b border-subtle">
        <button onClick={() => setTab("providers")} className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 ${tab === "providers" ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"}`}>
          <Zap size={14} /> Providers
        </button>
        <button onClick={() => setTab("matches")} className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 ${tab === "matches" ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"}`}>
          <ListVideo size={14} /> Match Streams
        </button>
      </div>

      {tab === "providers" && <ProvidersTab />}
      {tab === "matches" && <MatchStreamsTab />}
    </div>
  );
}

function StatusBadge({ status }: { status: Provider["connection_status"] }) {
  const { t } = useLocale();
  if (status === "connected") return <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/30"><CheckCircle2 size={11} /> {t("strm.connected")}</span>;
  if (status === "error") return <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#FF3B5C]/10 text-[#FF6B85] border border-[#FF3B5C]/30"><XCircle size={11} /> {t("strm.error")}</span>;
  return <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-muted border border-subtle"><HelpCircle size={11} /> {t("strm.unknown")}</span>;
}

function ProvidersTab() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", key: "", base_api_url: "", priority: 0 });
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [credentialsProviderId, setCredentialsProviderId] = useState<string | null>(null);
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("streaming_providers").select("*").is("deleted_at", null).order("priority");
    setProviders((data as Provider[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ name: "", key: "", base_api_url: "", priority: 0 }); setEditingId(null); setShowForm(true); setError(""); };
  const openEdit = (p: Provider) => { setForm({ name: p.name, key: p.key, base_api_url: p.base_api_url, priority: p.priority }); setEditingId(p.id); setShowForm(true); setError(""); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !isValidHttpUrl(form.base_api_url)) { setError("Nom va to'g'ri Base API URL kiriting."); return; }
    const payload = { name: form.name.trim(), key: form.key.trim() || slugify(form.name), base_api_url: form.base_api_url.trim(), priority: Number(form.priority) || 0 };
    const result = editingId
      ? await supabase.from("streaming_providers").update(payload).eq("id", editingId)
      : await supabase.from("streaming_providers").insert(payload);
    if (result.error) { setError(`Saqlashda xatolik: ${result.error.message}`); return; }
    setShowForm(false);
    load();
  };

  const toggleActive = async (p: Provider) => {
    await supabase.from("streaming_providers").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("strm.confirmDel"))) return;
    await supabase.from("streaming_providers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const testConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const res = await fetch("/api/admin/streaming/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const json = await res.json();
      if (res.status === 429) toast.error("Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urinib ko'ring.");
      else if (!json.success) toast.error(`Ulanish muvaffaqiyatsiz: ${json.message ?? "noma'lum xato"}`);
    } catch {
      toast.error("Ulanishni tekshirishda xatolik.");
    } finally {
      setTestingId(null);
      load();
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Add Provider
        </button>
      </div>

      <div className="space-y-3">
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[14px]">{p.name}</span>
                  <StatusBadge status={p.connection_status} />
                </div>
                <div className="text-[11px] text-muted mt-1">
                  {p.base_api_url} · priority {p.priority}
                  {p.last_sync_at && ` · oxirgi tekshiruv: ${new Date(p.last_sync_at).toLocaleString()}`}
                </div>
                {p.last_error && <div className="text-[11px] text-[#FF6B85] mt-1">Oxirgi xato: {p.last_error}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => testConnection(p.id)} disabled={testingId === p.id} className="px-3 py-1.5 rounded-md border border-subtle text-[11px] font-semibold hover:bg-white/5 disabled:opacity-50 flex items-center gap-1.5">
                  {testingId === p.id ? <Loader2 size={12} className="animate-spin" /> : null} Test Connection
                </button>
                <button onClick={() => setCredentialsProviderId(p.id)} className="p-2 rounded-md hover:bg-white/10" aria-label="Kalitlar"><KeyRound size={14} /></button>
                <button onClick={() => toggleActive(p)} className={`text-[11px] px-2 py-1 rounded-full border ${p.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-subtle"}`}>{p.is_active ? "Faol" : "Faolsiz"}</button>
                <button onClick={() => openEdit(p)} className="p-2 rounded-md hover:bg-white/10" aria-label="Tahrirlash"><Pencil size={14} /></button>
                <button onClick={() => remove(p.id)} className="p-2 rounded-md hover:bg-white/10 text-[#FF6B85]" aria-label="O'chirish"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {providers.length === 0 && <p className="text-[12px] text-muted text-center py-8">{t("strm.noProviders")}</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
          <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-subtle bg-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px]">{editingId ? "Providerni tahrirlash" : "Yangi Provider"}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Yopish"><X size={18} /></button>
            </div>
            <label className="block text-[12px] text-muted mb-1">{t("strm.fName")}</label>
            <input className={`${inputCls} mb-3`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label className="block text-[12px] text-muted mb-1">{t("strm.fSlug")}</label>
            <input className={`${inputCls} mb-3`} value={form.key} onChange={(e) => setForm({ ...form, key: slugify(e.target.value) })} placeholder={slugify(form.name || "")} />
            <label className="block text-[12px] text-muted mb-1">{t("strm.baseUrl")}</label>
            <input className={`${inputCls} mb-3`} value={form.base_api_url} onChange={(e) => setForm({ ...form, base_api_url: e.target.value })} placeholder="https://api.provider.com" />
            <label className="block text-[12px] text-muted mb-1">{t("strm.priority")}</label>
            <input type="number" className={`${inputCls} mb-4`} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}
            <button type="submit" className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px]">{t("strm.save")}</button>
            {!editingId && <p className="text-[11px] text-muted mt-3">{t("strm.saveHint")}</p>}
          </form>
        </div>
      )}

      {credentialsProviderId && (
        <CredentialsModal providerId={credentialsProviderId} onClose={() => setCredentialsProviderId(null)} />
      )}
    </div>
  );
}

function CredentialsModal({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<{ hasApiKey: boolean; hasApiSecret: boolean } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/admin/streaming/credentials?providerId=${providerId}`);
    if (res.ok) setStatus(await res.json());
  };
  useEffect(() => { load(); }, [providerId]);

  const save = async (field: "api_key" | "api_secret", value: string) => {
    if (!value) return;
    setError("");
    setSaving(field);
    try {
      const res = await fetch("/api/admin/streaming/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, field, value }),
      });
      if (!res.ok) throw new Error();
      if (field === "api_key") setApiKey(""); else setApiSecret("");
      load();
    } catch {
      setError("Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-subtle bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">{t("strm.apiKeys")}</h2>
          <button onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-muted mb-4 leading-relaxed">
          Kalitlar shifrlanib saqlanadi (AES-256-GCM) va saqlangandan keyin qayta ko'rsatilmaydi.
        </p>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-[12px] text-muted">{t("strm.apiKey")}</label>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${status?.hasApiKey ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-subtle"}`}>
              {status?.hasApiKey ? "Sozlangan" : "Sozlanmagan"}
            </span>
          </div>
          <div className="flex gap-2">
            <input type="password" className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <button onClick={() => save("api_key", apiKey)} disabled={saving === "api_key" || !apiKey} className="px-4 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[13px] font-semibold disabled:opacity-50 shrink-0">
              {saving === "api_key" ? "…" : "Saqlash"}
            </button>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-[12px] text-muted">{t("strm.apiSecret")}</label>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${status?.hasApiSecret ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-subtle"}`}>
              {status?.hasApiSecret ? "Sozlangan" : "Sozlanmagan"}
            </span>
          </div>
          <div className="flex gap-2">
            <input type="password" className={inputCls} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
            <button onClick={() => save("api_secret", apiSecret)} disabled={saving === "api_secret" || !apiSecret} className="px-4 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[13px] font-semibold disabled:opacity-50 shrink-0">
              {saving === "api_secret" ? "…" : "Saqlash"}
            </button>
          </div>
        </div>
        {error && <p className="text-[12px] text-[#FF6B85] mt-2">{error}</p>}
      </div>
    </div>
  );
}

type MatchStream = {
  id: string;
  football_provider: string;
  external_fixture_id: string;
  streaming_provider_id: string;
  external_stream_id: string | null;
  is_primary: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  streaming_providers?: { name: string };
};

const FOOTBALL_PROVIDERS = [
  { id: "api_football", label: "API-Football" },
  { id: "sportmonks", label: "Sportmonks" },
  { id: "football_data_org", label: "Football-Data.org" },
];

function MatchStreamsTab() {
  const { t } = useLocale();
  const [streams, setStreams] = useState<MatchStream[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    football_provider: "api_football", external_fixture_id: "", streaming_provider_id: "",
    external_stream_id: "", is_primary: false, starts_at: "", ends_at: "",
  });
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const [{ data: streamsData }, { data: providersData }] = await Promise.all([
      supabase.from("match_streams").select("*, streaming_providers(name)").order("created_at", { ascending: false }),
      supabase.from("streaming_providers").select("id, name").eq("is_active", true).is("deleted_at", null),
    ]);
    setStreams((streamsData as MatchStream[]) ?? []);
    setProviders(providersData ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.external_fixture_id.trim() || !form.streaming_provider_id) { setError("O'yin ID va providerni tanlang."); return; }
    const payload = {
      football_provider: form.football_provider,
      external_fixture_id: form.external_fixture_id.trim(),
      streaming_provider_id: form.streaming_provider_id,
      external_stream_id: form.external_stream_id.trim() || null,
      is_primary: form.is_primary,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    const { error: insertError } = await supabase.from("match_streams").insert(payload);
    if (insertError) { setError(`Saqlashda xatolik: ${insertError.message}`); return; }
    setForm({ football_provider: "api_football", external_fixture_id: "", streaming_provider_id: "", external_stream_id: "", is_primary: false, starts_at: "", ends_at: "" });
    load();
  };

  const toggleActive = async (s: MatchStream) => {
    await supabase.from("match_streams").update({ is_active: !s.is_active }).eq("id", s.id);
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("match_streams").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <p className="text-[12px] text-muted mb-4 leading-relaxed">
        O'yin ID'ni Football Center yoki tegishli provayder tizimidan oling. Bir o'yinga bir nechta
        provider qo'shish mumkin — "Primary" belgilangani asosiy, qolganlari zaxira (fallback) sifatida
        ishlatiladi.
      </p>

      <form onSubmit={add} className="rounded-xl glass-card p-5 mb-6 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select
            className={`${inputCls} flex items-center justify-between gap-2`}
            value={form.football_provider}
            onChange={(v) => setForm({ ...form, football_provider: v })}
            options={FOOTBALL_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <input className={inputCls} placeholder={t("strm.phFixtureId")} value={form.external_fixture_id} onChange={(e) => setForm({ ...form, external_fixture_id: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select
            className={`${inputCls} flex items-center justify-between gap-2`}
            value={form.streaming_provider_id}
            onChange={(v) => setForm({ ...form, streaming_provider_id: v })}
            options={[
              { value: "", label: "— Streaming provider tanlang —" },
              ...providers.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <input className={inputCls} placeholder={t("strm.phStreamId")} value={form.external_stream_id} onChange={(e) => setForm({ ...form, external_stream_id: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-muted mb-1">{t("strm.startAt")}</label>
            <input type="datetime-local" className={inputCls} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">{t("strm.endAt")}</label>
            <input type="datetime-local" className={inputCls} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-[12px]">
          <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} /> Primary provider
        </label>
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold"><Plus size={14} /> Qo'shish</button>
      </form>

      <div className="space-y-2">
        {streams.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-subtle p-3">
            <div className="text-[12px]">
              <span className="font-medium">{s.streaming_providers?.name ?? "—"}</span>
              {s.is_primary && <span className="text-[10px] text-vip ml-1.5">★ primary</span>}
              <div className="text-muted mt-0.5">{s.football_provider} · O'yin ID {s.external_fixture_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(s)} className={`text-[10px] px-2 py-1 rounded-full border ${s.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-subtle"}`}>{s.is_active ? "Faol" : "Faolsiz"}</button>
              <button onClick={() => remove(s.id)} className="p-1 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {streams.length === 0 && <p className="text-[12px] text-muted text-center py-6">{t("strm.noStreams")}</p>}
      </div>
    </div>
  );
}
