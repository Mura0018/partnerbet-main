"use client";

import React, { useEffect, useState } from "react";
import {
  Globe, Palette, Share2, Search, BarChart3, KeyRound, Wrench, Upload, Check, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/media/upload";

type SettingsMap = Record<string, any>;
type SecretStatuses = Record<string, boolean>;
type Tab = "general" | "branding" | "social" | "seo" | "analytics" | "api" | "maintenance";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "general", label: "Umumiy", icon: Globe },
  { id: "branding", label: "Brend", icon: Palette },
  { id: "social", label: "Ijtimoiy tarmoq", icon: Share2 },
  { id: "seo", label: "SEO", icon: Search },
  { id: "analytics", label: "Analitika", icon: BarChart3 },
  { id: "api", label: "API kalitlar", icon: KeyRound },
  { id: "maintenance", label: "Texnik ishlar", icon: Wrench },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] text-white outline-none focus:border-accent transition-colors";

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-60"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
      {saving ? "Saqlanmoqda…" : saved ? "Saqlandi" : "Saqlash"}
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<SettingsMap>({});
  const [secretStatuses, setSecretStatuses] = useState<SecretStatuses>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, secretsRes] = await Promise.all([
      supabase.from("site_settings").select("key, value"),
      fetch("/api/admin/secrets").then((r) => (r.ok ? r.json() : { statuses: {} })),
    ]);
    const map: SettingsMap = {};
    for (const row of rows ?? []) map[row.key] = row.value;
    setSettings(map);
    setSecretStatuses(secretsRes.statuses ?? {});
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateLocal = (key: string, patch: Record<string, any>) => {
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveKey = async (key: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("site_settings")
      .update({ value: settings[key] ?? {}, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("key", key);
  };

  if (loading) {
    return <div className="p-8 text-[13px] text-muted">Yuklanmoqda…</div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-[22px] font-bold mb-1">Sayt sozlamalari</h1>
      <p className="text-[13px] text-muted mb-6">Sayt bo'yicha barcha global sozlamalar shu yerdan boshqariladi.</p>

      <div className="flex gap-1 mb-6 border-b border-white/8 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && <GeneralTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} />}
      {activeTab === "branding" && <BrandingTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} />}
      {activeTab === "social" && <SocialTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} />}
      {activeTab === "seo" && <SeoTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} />}
      {activeTab === "analytics" && <AnalyticsTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} />}
      {activeTab === "api" && <ApiKeysTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} secretStatuses={secretStatuses} onSaved={load} />}
      {activeTab === "maintenance" && <MaintenanceTab settings={settings} updateLocal={updateLocal} saveKey={saveKey} />}
    </div>
  );
}

type TabProps = {
  settings: SettingsMap;
  updateLocal: (key: string, patch: Record<string, any>) => void;
  saveKey: (key: string) => Promise<void>;
};

function useSaveState() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    setSaved(false);
    await fn();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return { saving, saved, run };
}

function GeneralTab({ settings, updateLocal, saveKey }: TabProps) {
  const { saving, saved, run } = useSaveState();
  const identity = settings.site_identity ?? {};
  const contact = settings.contact_info ?? {};
  const footer = settings.footer ?? {};

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <Field label="Sayt nomi">
        <input className={inputCls} value={identity.site_name ?? ""} onChange={(e) => updateLocal("site_identity", { site_name: e.target.value })} placeholder="WINORA" />
      </Field>
      <Field label="Slogan">
        <input className={inputCls} value={identity.tagline ?? ""} onChange={(e) => updateLocal("site_identity", { tagline: e.target.value })} />
      </Field>
      <Field label="Qo'llab-quvvatlash emaili">
        <input type="email" className={inputCls} value={contact.email ?? ""} onChange={(e) => updateLocal("contact_info", { email: e.target.value })} placeholder="support@couponbet.org" />
      </Field>
      <Field label="Telefon">
        <input className={inputCls} value={contact.phone ?? ""} onChange={(e) => updateLocal("contact_info", { phone: e.target.value })} />
      </Field>
      <Field label="Footer tavsifi">
        <textarea rows={3} className={inputCls} value={footer.description ?? ""} onChange={(e) => updateLocal("footer", { description: e.target.value })} />
      </Field>
      <SaveButton saving={saving} saved={saved} onClick={() => run(async () => { await saveKey("site_identity"); await saveKey("contact_info"); await saveKey("footer"); })} />
    </div>
  );
}

function BrandingTab({ settings, updateLocal, saveKey }: TabProps) {
  const { saving, saved, run } = useSaveState();
  const branding = settings.branding ?? {};
  const theme = settings.theme ?? {};
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (file: File, field: "logo_media_id" | "favicon_media_id" | "hero_image_media_id", setUploading: (b: boolean) => void) => {
    setError("");
    setUploading(true);
    try {
      const media = await uploadImage(file);
      updateLocal("branding", { [field]: media.id, [`${field}_url`]: media.publicUrl });
    } catch (e: any) {
      setError(e.message ?? "Yuklashda xatolik yuz berdi.");
    } finally {
      setUploading(false);
    }
  };

  const [heroUploading, setHeroUploading] = useState(false);

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <Field label="Logotip">
        <div className="flex items-center gap-3">
          {branding.logo_media_id_url && <img src={branding.logo_media_id_url} alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-white/10" />}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[13px] cursor-pointer hover:bg-white/5">
            {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Yuklash
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={logoUploading}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo_media_id", setLogoUploading)} />
          </label>
        </div>
      </Field>
      <Field label="Favicon">
        <div className="flex items-center gap-3">
          {branding.favicon_media_id_url && <img src={branding.favicon_media_id_url} alt="Favicon" className="w-8 h-8 rounded object-cover border border-white/10" />}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[13px] cursor-pointer hover:bg-white/5">
            {faviconUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Yuklash
            <input type="file" accept="image/png,image/x-icon,image/svg+xml" className="hidden" disabled={faviconUploading}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon_media_id", setFaviconUploading)} />
          </label>
        </div>
      </Field>
      {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}

      <Field label="Bosh sahifa hero rasmi">
        <div className="flex items-center gap-3 mb-2">
          {branding.hero_image_media_id_url && (
            <img src={branding.hero_image_media_id_url} alt="Hero" className="w-16 h-20 rounded-lg object-cover border border-white/10 bg-black/20" />
          )}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[13px] cursor-pointer hover:bg-white/5">
            {heroUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Yuklash
            <input type="file" accept="image/png,image/webp" className="hidden" disabled={heroUploading}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "hero_image_media_id", setHeroUploading)} />
          </label>
        </div>
        <p className="text-[11px] text-[#5b6f85]">
          Tavsiya: shaffof fonli (PNG) rasm, taxminan 1200×1600px, 3MB dan kichik. Bir xil rasm kompyuter va telefonda avtomatik moslashadi — alohida versiya yuklash shart emas.
        </p>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Asosiy rang">
          <input type="color" className="w-full h-10 bg-white/5 border border-white/10 rounded-lg cursor-pointer" value={theme.accent_color ?? "#00A3FF"} onChange={(e) => updateLocal("theme", { accent_color: e.target.value })} />
        </Field>
        <Field label="Ikkinchi rang">
          <input type="color" className="w-full h-10 bg-white/5 border border-white/10 rounded-lg cursor-pointer" value={theme.secondary_color ?? "#FFC857"} onChange={(e) => updateLocal("theme", { secondary_color: e.target.value })} />
        </Field>
        <Field label="Fon rangi">
          <input type="color" className="w-full h-10 bg-white/5 border border-white/10 rounded-lg cursor-pointer" value={theme.background_color ?? "#07111F"} onChange={(e) => updateLocal("theme", { background_color: e.target.value })} />
        </Field>
      </div>
      <p className="text-[11px] text-[#5b6f85] mb-4">Ranglar saqlangach, butun saytda darhol qo'llaniladi — qayta deploy shart emas.</p>

      <SaveButton saving={saving} saved={saved} onClick={() => run(async () => { await saveKey("branding"); await saveKey("theme"); })} />
    </div>
  );
}

function SocialTab({ settings, updateLocal, saveKey }: TabProps) {
  const { saving, saved, run } = useSaveState();
  const social = settings.social_links ?? {};
  const platforms: { key: string; label: string }[] = [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "telegram", label: "Telegram" },
    { key: "twitter", label: "Twitter / X" },
  ];
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      {platforms.map((p) => (
        <Field key={p.key} label={p.label}>
          <input className={inputCls} value={social[p.key] ?? ""} onChange={(e) => updateLocal("social_links", { [p.key]: e.target.value })} placeholder={`https://${p.key}.com/...`} />
        </Field>
      ))}
      <SaveButton saving={saving} saved={saved} onClick={() => run(() => saveKey("social_links"))} />
    </div>
  );
}

function SeoTab({ settings, updateLocal, saveKey }: TabProps) {
  const { saving, saved, run } = useSaveState();
  const seo = settings.seo_defaults ?? {};
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <Field label="Standart sarlavha (title)">
        <input className={inputCls} value={seo.default_title ?? ""} onChange={(e) => updateLocal("seo_defaults", { default_title: e.target.value })} />
      </Field>
      <Field label="Standart tavsif (description)">
        <textarea rows={3} className={inputCls} value={seo.default_description ?? ""} onChange={(e) => updateLocal("seo_defaults", { default_description: e.target.value })} />
      </Field>
      <SaveButton saving={saving} saved={saved} onClick={() => run(() => saveKey("seo_defaults"))} />
    </div>
  );
}

function AnalyticsTab({ settings, updateLocal, saveKey }: TabProps) {
  const { saving, saved, run } = useSaveState();
  const analytics = settings.analytics ?? {};
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <Field label="Google Analytics Measurement ID">
        <input className={inputCls} value={analytics.ga_measurement_id ?? ""} onChange={(e) => updateLocal("analytics", { ga_measurement_id: e.target.value })} placeholder="G-XXXXXXXXXX" />
      </Field>
      <Field label="Meta (Facebook) Pixel ID">
        <input className={inputCls} value={analytics.meta_pixel_id ?? ""} onChange={(e) => updateLocal("analytics", { meta_pixel_id: e.target.value })} />
      </Field>
      <p className="text-[11px] text-[#5b6f85] mb-4">
        Bu ID'lar shu yerda saqlanadi; sahifalarga real skript sifatida ulash Phase 5 (Frontend) doirasida amalga oshiriladi.
      </p>
      <SaveButton saving={saving} saved={saved} onClick={() => run(() => saveKey("analytics"))} />
    </div>
  );
}

function ApiKeysTab({ settings, updateLocal, saveKey, secretStatuses, onSaved }: TabProps & { secretStatuses: SecretStatuses; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { saving: savingProvider, saved: savedProvider, run: runProviderSave } = useSaveState();
  const footballProvider = settings.football_provider ?? {};

  const PROVIDERS = [
    { id: "", label: "— Tanlanmagan —" },
    { id: "api_football", label: "API-Football" },
    { id: "sportmonks", label: "Sportmonks" },
    { id: "football_data_org", label: "Football-Data.org" },
  ];

  const FOOTBALL_KEYS: { key: string; label: string; placeholder: string }[] = [
    { key: "football_api_key", label: "API-Football kaliti", placeholder: "x-apisports-key" },
    { key: "sportmonks_api_key", label: "Sportmonks kaliti", placeholder: "api_token" },
    { key: "footballdata_org_api_key", label: "Football-Data.org kaliti", placeholder: "X-Auth-Token" },
  ];
  const PUSH_KEYS: { key: string; label: string; placeholder: string }[] = [
    { key: "push_fcm_server_key", label: "Push — FCM Server Key", placeholder: "AAAA..." },
    { key: "push_vapid_public_key", label: "Push — VAPID Public Key", placeholder: "BF..." },
    { key: "push_vapid_private_key", label: "Push — VAPID Private Key", placeholder: "..." },
  ];
  const AI_KEYS: { key: string; label: string; placeholder: string }[] = [
    { key: "openai_api_key", label: "OpenAI API kaliti (Match Insights uchun)", placeholder: "sk-..." },
  ];
  const TELEGRAM_KEYS: { key: string; label: string; placeholder: string }[] = [
    { key: "telegram_bot_token", label: "Telegram Bot Token (BetCore Pay)", placeholder: "123456789:ABC..." },
    { key: "telegram_webhook_secret", label: "Webhook Secret Token", placeholder: "o'zingiz o'ylab topgan tasodifiy matn" },
  ];

  const save = async (key: string) => {
    if (!values[key]) return;
    setError("");
    setSaving(key);
    try {
      const res = await fetch("/api/admin/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] }),
      });
      if (!res.ok) throw new Error();
      setValues((prev) => ({ ...prev, [key]: "" }));
      onSaved();
    } catch {
      setError("Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(null);
    }
  };

  const renderKeyRow = (k: { key: string; label: string; placeholder: string }) => (
    <div key={k.key} className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[12px] text-muted">{k.label}</label>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${secretStatuses[k.key] ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-[#5b6f85] border-white/10"}`}>
          {secretStatuses[k.key] ? "Sozlangan" : "Sozlanmagan"}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          className={inputCls}
          placeholder={k.placeholder}
          value={values[k.key] ?? ""}
          onChange={(e) => setValues((prev) => ({ ...prev, [k.key]: e.target.value }))}
        />
        <button
          onClick={() => save(k.key)}
          disabled={saving === k.key || !values[k.key]}
          className="px-4 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[13px] font-semibold disabled:opacity-50 shrink-0"
        >
          {saving === k.key ? "…" : "Saqlash"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="text-[13px] font-semibold mb-1">Football Center — ma'lumot manbai</h3>
        <p className="text-[12px] text-[#5b6f85] mb-4 leading-relaxed">
          Faol provayderni tanlang. Hech biri tanlanmasa, Football Center "hozircha jonli
          ma'lumot yo'q" holatini professional ko'rinishda ko'rsatadi — sayt buzilmaydi.
          Kelajakda boshqa provayderga o'tish — shu yerda faqat tanlovni almashtirish, kod
          o'zgartirish shart emas.
        </p>
        <Field label="Faol provayder">
          <select className={inputCls} value={footballProvider.active ?? ""} onChange={(e) => updateLocal("football_provider", { active: e.target.value || null })}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Standart liga ID">
            <input className={inputCls} value={footballProvider.default_league_id ?? ""} onChange={(e) => updateLocal("football_provider", { default_league_id: e.target.value })} placeholder="masalan: 39" />
          </Field>
          <Field label="Standart mavsum">
            <input className={inputCls} value={footballProvider.default_season ?? ""} onChange={(e) => updateLocal("football_provider", { default_season: e.target.value })} placeholder="masalan: 2026" />
          </Field>
        </div>
        <p className="text-[11px] text-[#5b6f85] mb-3">
          Liga ID/mavsum formati tanlangan provayderga bog'liq (masalan API-Football raqamli liga
          ID ishlatadi, Football-Data.org qisqa kod ishlatadi) — "Featured Leagues" bo'limida
          aniq qiymatlarni ko'rasiz.
        </p>
        <SaveButton saving={savingProvider} saved={savedProvider} onClick={() => runProviderSave(() => saveKey("football_provider"))} />
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
        <p className="text-[12px] text-[#5b6f85] mb-4 leading-relaxed">
          Xavfsizlik uchun kalitlar saqlangandan keyin qayta ko'rsatilmaydi — faqat
          "sozlangan" holati ko'rinadi. Yangilash uchun yangi qiymatni kiriting va saqlang.
        </p>
        {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}
        <h3 className="text-[13px] font-semibold mb-3">Football provayder kalitlari</h3>
        {FOOTBALL_KEYS.map(renderKeyRow)}
        <h3 className="text-[13px] font-semibold mb-3 mt-2">Push xabarnoma kalitlari</h3>
        <p className="text-[11px] text-[#5b6f85] mb-3">Hozircha faqat xavfsiz saqlanadi — xabar yuborish funksiyasi Phase 4'da qo'shiladi.</p>
        {PUSH_KEYS.map(renderKeyRow)}
        <h3 className="text-[13px] font-semibold mb-3 mt-2">AI kalitlari</h3>
        <p className="text-[11px] text-[#5b6f85] mb-3">Match Insights uchun avtomatik matn xulosa generatsiyasida ishlatiladi.</p>
        {AI_KEYS.map(renderKeyRow)}
        <h3 className="text-[13px] font-semibold mb-3 mt-2">Telegram Bot kalitlari</h3>
        <p className="text-[11px] text-[#5b6f85] mb-3">BetCore Pay — hisob to'ldirish/yechish uchun Telegram bot.</p>
        {TELEGRAM_KEYS.map(renderKeyRow)}
        <p className="text-[11px] text-[#5b6f85] mb-3 leading-relaxed">
          "Webhook Secret Token"ni saqlagandan so'ng, xuddi shu qiymatni Telegram tomonida ham
          o'rnatish kerak — aks holda webhook ishlamay qoladi:{" "}
          <code className="text-[10px] bg-white/5 px-1 py-0.5 rounded break-all">
            {'curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.couponbet.org/api/telegram/webhook&secret_token=<SECRET>"'}
          </code>
        </p>
      </div>
    </div>
  );
}

function MaintenanceTab({ settings, updateLocal, saveKey }: TabProps) {
  const { saving, saved, run } = useSaveState();
  const maintenance = settings.maintenance ?? {};
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <label className="flex items-center gap-3 mb-4 cursor-pointer">
        <input type="checkbox" checked={!!maintenance.enabled} onChange={(e) => updateLocal("maintenance", { enabled: e.target.checked })} />
        <span className="text-[13px] font-medium">Texnik ishlar rejimini yoqish</span>
      </label>
      <p className="text-[11px] text-[#5b6f85] mb-4 leading-relaxed">
        Yoqilganda, admin bo'lmagan barcha tashrifchilar "Texnik ishlar" sahifasini ko'radi.
        Admin hisoblar saytni odatdagidek ko'rishda davom etadi.
      </p>
      <Field label="Xabar matni (ixtiyoriy)">
        <textarea rows={3} className={inputCls} value={maintenance.message ?? ""} onChange={(e) => updateLocal("maintenance", { message: e.target.value })} placeholder="Sayt qisqa vaqt ichida yana ishga tushadi." />
      </Field>
      <SaveButton saving={saving} saved={saved} onClick={() => run(() => saveKey("maintenance"))} />
    </div>
  );
}
