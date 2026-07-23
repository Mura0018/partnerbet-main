"use client";

import React, { useEffect, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Star, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Tag, Route, Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/media/upload";
import { isValidHttpUrl, isValidDeepLink } from "@/lib/validation/url";

type Partner = {
  id: string;
  slug: string;
  name: string;
  logo_media_id: string | null;
  logo_url?: string | null;
  description: string | null;
  website_url: string | null;
  affiliate_url: string;
  apk_url: string | null;
  google_play_url: string | null;
  app_store_url: string | null;
  deep_link: string | null;
  bonus_description: string | null;
  countries: string[] | null;
  languages: string[] | null;
  rating: number | null;
  priority: number;
  is_active: boolean;
  is_featured: boolean;
  link_health: Record<string, { status: string; checkedAt: string }>;
  link_health_checked_at: string | null;
  click_count: number;
};

type PromoCode = {
  id: string;
  partner_id: string;
  code: string;
  bonus_description: string | null;
  is_featured: boolean;
  is_active: boolean;
  expires_at: string | null;
  usage_count: number;
};

type RedirectRule = {
  id: string;
  partner_id: string;
  match_type: "country" | "language" | "device";
  match_value: string;
  target_url: string;
  priority: number;
  is_active: boolean;
};

const EMPTY_PARTNER = {
  slug: "", name: "", logo_media_id: null as string | null, description: "",
  website_url: "", affiliate_url: "", apk_url: "", google_play_url: "", app_store_url: "", deep_link: "",
  bonus_description: "", countries: [] as string[], languages: [] as string[],
  rating: null as number | null, priority: 0, is_active: true, is_featured: false,
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function LinkHealthBadge({ result }: { result?: { status: string } }) {
  if (!result) return <ShieldQuestion size={13} className="text-[#5b6f85]" />;
  if (result.status === "ok") return <ShieldCheck size={13} className="text-[#4ADE80]" />;
  return <ShieldAlert size={13} className="text-[#FF6B85]" />;
}

export default function AffiliatesPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("affiliate_partners")
      .select("*")
      .is("deleted_at", null)
      .order("priority", { ascending: true });
    setPartners((data as Partner[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditingPartner(null); setShowModal(true); };
  const openEdit = (p: Partner) => { setEditingPartner(p); setShowModal(true); };

  const toggleActive = async (p: Partner) => {
    await supabase.from("affiliate_partners").update({ is_active: !p.is_active }).eq("id", p.id);
    load();
  };
  const toggleFeatured = async (p: Partner) => {
    await supabase.from("affiliate_partners").update({ is_featured: !p.is_featured }).eq("id", p.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Hamkor o'chirilsinmi?")) return;
    await supabase.from("affiliate_partners").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold">Affiliate Manager</h1>
          <p className="text-[13px] text-muted mt-1">Hamkorlar, promo-kodlar, smart redirect va link salomatligi.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Yangi hamkor
        </button>
      </div>

      {loading && <p className="text-[13px] text-muted">Yuklanmoqda…</p>}

      <div className="space-y-3">
        {partners.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] truncate">{p.name}</span>
                    {p.is_featured && <Star size={12} className="text-vip shrink-0" fill="currentColor" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[#5b6f85]">
                    <span>/go/{p.slug}</span>
                    <span>·</span>
                    <span>{p.click_count} klik</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <LinkHealthBadge result={p.link_health?.affiliate_url} /> affiliate
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => toggleFeatured(p)} className="p-1.5 rounded-md hover:bg-white/10" aria-label="Featured" title="Featured">
                  <Star size={14} className={p.is_featured ? "text-vip" : "text-[#5b6f85]"} fill={p.is_featured ? "currentColor" : "none"} />
                </button>
                <button onClick={() => toggleActive(p)} className={`text-[11px] px-2 py-1 rounded-full border ${p.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-[#5b6f85] border-white/10"}`}>
                  {p.is_active ? "Faol" : "Faolsiz"}
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-white/10" aria-label="Tahrirlash"><Pencil size={14} /></button>
                <button onClick={() => remove(p.id)} className="p-1.5 rounded-md hover:bg-white/10 text-[#FF6B85]" aria-label="O'chirish"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {!loading && partners.length === 0 && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-[#5b6f85]">
            Hozircha hamkor yo'q. "Yangi hamkor" tugmasi orqali qo'shing.
          </div>
        )}
      </div>

      {showModal && (
        <PartnerModal
          partner={editingPartner}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

type ModalTab = "details" | "promos" | "rules" | "health";

function PartnerModal({ partner, onClose, onSaved }: { partner: Partner | null; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<ModalTab>("details");
  const [currentPartner, setCurrentPartner] = useState<Partner | null>(partner);
  const [form, setForm] = useState<any>(
    partner ?? { ...EMPTY_PARTNER }
  );
  const [countriesInput, setCountriesInput] = useState((partner?.countries ?? []).join(", "));
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const LANG_OPTIONS = ["uz", "ru", "en"];

  const toggleLanguage = (lang: string) => {
    const current: string[] = form.languages ?? [];
    setForm({ ...form, languages: current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang] });
  };

  const handleLogoUpload = async (file: File) => {
    setError("");
    setLogoUploading(true);
    try {
      const media = await uploadImage(file);
      setForm({ ...form, logo_media_id: media.id, logo_url: media.publicUrl });
    } catch (e: any) {
      setError(e.message ?? "Yuklashda xatolik.");
    } finally {
      setLogoUploading(false);
    }
  };

  const validate = (): string | null => {
    if (!form.name?.trim()) return "Hamkor nomini kiriting.";
    if (!isValidHttpUrl(form.affiliate_url)) return "Affiliate URL noto'g'ri (http:// yoki https:// bilan boshlanishi kerak).";
    if (form.website_url && !isValidHttpUrl(form.website_url)) return "Website URL noto'g'ri.";
    if (form.apk_url && !isValidHttpUrl(form.apk_url)) return "APK URL noto'g'ri.";
    if (form.google_play_url && !isValidHttpUrl(form.google_play_url)) return "Google Play URL noto'g'ri.";
    if (form.app_store_url && !isValidHttpUrl(form.app_store_url)) return "App Store URL noto'g'ri.";
    if (form.deep_link && !isValidDeepLink(form.deep_link)) return "Deep link formati noto'g'ri (masalan: myapp://open).";
    if (form.rating !== null && form.rating !== "" && (form.rating < 0 || form.rating > 5)) return "Reyting 0 dan 5 gacha bo'lishi kerak.";
    return null;
  };

  const saveDetails = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError("");
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      slug: form.slug?.trim() || slugify(form.name),
      name: form.name.trim(),
      logo_media_id: form.logo_media_id,
      logo_url: form.logo_url ?? null,
      description: form.description?.trim() || null,
      website_url: form.website_url?.trim() || null,
      affiliate_url: form.affiliate_url.trim(),
      apk_url: form.apk_url?.trim() || null,
      google_play_url: form.google_play_url?.trim() || null,
      app_store_url: form.app_store_url?.trim() || null,
      deep_link: form.deep_link?.trim() || null,
      bonus_description: form.bonus_description?.trim() || null,
      countries: countriesInput.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
      languages: form.languages ?? [],
      rating: form.rating === "" || form.rating === null ? null : Number(form.rating),
      priority: Number(form.priority) || 0,
      is_active: form.is_active,
      is_featured: form.is_featured,
    };

    if (currentPartner) {
      const { error: updateError } = await supabase.from("affiliate_partners").update(payload).eq("id", currentPartner.id);
      setSaving(false);
      if (updateError) { setError(updateError.message); return; }
      onSaved();
    } else {
      const { data, error: insertError } = await supabase
        .from("affiliate_partners")
        .insert({ ...payload, created_by: user?.id })
        .select("*")
        .single();
      setSaving(false);
      if (insertError || !data) { setError(insertError?.message ?? "Saqlashda xatolik."); return; }
      setCurrentPartner(data as Partner);
      setTab("promos");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-panel max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="font-bold text-[16px]">{currentPartner ? "Hamkorni tahrirlash" : "Yangi hamkor"}</h2>
          <button onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="flex gap-1 px-6 mt-4 border-b border-white/8">
          {[
            { id: "details" as ModalTab, label: "Ma'lumotlar", icon: Pencil, disabled: false },
            { id: "promos" as ModalTab, label: "Promo-kodlar", icon: Tag, disabled: !currentPartner },
            { id: "rules" as ModalTab, label: "Smart Redirect", icon: Route, disabled: !currentPartner },
            { id: "health" as ModalTab, label: "Link Health", icon: Activity, disabled: !currentPartner },
          ].map((t) => (
            <button
              key={t.id}
              disabled={t.disabled}
              onClick={() => setTab(t.id)}
              title={t.disabled ? "Avval hamkorni saqlang" : undefined}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition disabled:opacity-30 disabled:cursor-not-allowed ${
                tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {tab === "details" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                {form.logo_url && <img src={form.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10" />}
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-[12px] cursor-pointer hover:bg-white/5">
                  {logoUploading ? <Loader2 size={13} className="animate-spin" /> : null} Logotip yuklash
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={logoUploading}
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-muted mb-1">Nomi *</label>
                  <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Slug (/go/...)</label>
                  <input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder={slugify(form.name || "")} />
                </div>
              </div>

              <label className="block text-[11px] text-muted mb-1 mt-3">Tavsif</label>
              <textarea rows={2} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />

              <label className="block text-[11px] text-muted mb-1 mt-3">Bonus tavsifi</label>
              <textarea rows={2} className={inputCls} value={form.bonus_description ?? ""} onChange={(e) => setForm({ ...form, bonus_description: e.target.value })} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[11px] text-muted mb-1">Website URL</label>
                  <input className={inputCls} value={form.website_url ?? ""} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Affiliate URL *</label>
                  <input className={inputCls} value={form.affiliate_url ?? ""} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">APK URL</label>
                  <input className={inputCls} value={form.apk_url ?? ""} onChange={(e) => setForm({ ...form, apk_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Google Play URL</label>
                  <input className={inputCls} value={form.google_play_url ?? ""} onChange={(e) => setForm({ ...form, google_play_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">App Store URL</label>
                  <input className={inputCls} value={form.app_store_url ?? ""} onChange={(e) => setForm({ ...form, app_store_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Deep Link</label>
                  <input className={inputCls} value={form.deep_link ?? ""} onChange={(e) => setForm({ ...form, deep_link: e.target.value })} placeholder="myapp://open" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[11px] text-muted mb-1">Mamlakatlar (vergul bilan, bo'sh = hammasi)</label>
                  <input className={inputCls} value={countriesInput} onChange={(e) => setCountriesInput(e.target.value)} placeholder="UZ, RU, KZ" />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Tillar</label>
                  <div className="flex gap-2 mt-1">
                    {LANG_OPTIONS.map((l) => (
                      <button key={l} type="button" onClick={() => toggleLanguage(l)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border uppercase ${
                          (form.languages ?? []).includes(l) ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-[11px] text-muted mb-1">Reyting (0-5)</label>
                  <input type="number" min={0} max={5} step={0.1} className={inputCls} value={form.rating ?? ""} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Tartib (priority)</label>
                  <input type="number" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Faol</label>
                  <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured</label>
                </div>
              </div>

              {error && <p className="text-[12px] text-[#FF6B85] mt-3">{error}</p>}
              <button onClick={saveDetails} disabled={saving} className="w-full mt-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-60">
                {saving ? "Saqlanmoqda…" : currentPartner ? "Saqlash" : "Yaratish va davom etish"}
              </button>
            </div>
          )}

          {tab === "promos" && currentPartner && <PromoCodesTab partnerId={currentPartner.id} />}
          {tab === "rules" && currentPartner && <RedirectRulesTab partnerId={currentPartner.id} />}
          {tab === "health" && currentPartner && <LinkHealthTab partner={currentPartner} onChecked={(p) => setCurrentPartner(p)} />}
        </div>
      </div>
    </div>
  );
}

function PromoCodesTab({ partnerId }: { partnerId: string }) {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [form, setForm] = useState({ code: "", bonus_description: "", is_featured: false, expires_at: "" });
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("promo_codes").select("*").eq("partner_id", partnerId).is("deleted_at", null).order("created_at", { ascending: false });
    setCodes((data as PromoCode[]) ?? []);
  };
  useEffect(() => { load(); }, [partnerId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.code.trim()) { setError("Kod matnini kiriting."); return; }
    const { error: insertError } = await supabase.from("promo_codes").insert({
      partner_id: partnerId,
      code: form.code.trim(),
      bonus_description: form.bonus_description.trim() || null,
      is_featured: form.is_featured,
      expires_at: form.expires_at || null,
    });
    if (insertError) { setError(insertError.message); return; }
    setForm({ code: "", bonus_description: "", is_featured: false, expires_at: "" });
    load();
  };

  const toggleActive = async (c: PromoCode) => {
    await supabase.from("promo_codes").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("promo_codes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div>
      <form onSubmit={add} className="rounded-lg border border-white/8 p-4 mb-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Promo kod (masalan: WELCOME100)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input type="date" className={inputCls} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
        </div>
        <input className={inputCls} placeholder="Bonus tavsifi" value={form.bonus_description} onChange={(e) => setForm({ ...form, bonus_description: e.target.value })} />
        <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured</label>
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold">Kod qo'shish</button>
      </form>

      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/8 p-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-[13px]">{c.code}</span>
                {c.is_featured && <Star size={11} className="text-vip" fill="currentColor" />}
              </div>
              <div className="text-[11px] text-[#5b6f85] mt-0.5">{c.bonus_description} · {c.usage_count} marta ishlatilgan{c.expires_at ? ` · muddat: ${new Date(c.expires_at).toLocaleDateString()}` : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(c)} className={`text-[10px] px-2 py-1 rounded-full border ${c.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-[#5b6f85] border-white/10"}`}>{c.is_active ? "Faol" : "Faolsiz"}</button>
              <button onClick={() => remove(c.id)} className="p-1 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {codes.length === 0 && <p className="text-[12px] text-[#5b6f85] text-center py-4">Hozircha promo-kod yo'q.</p>}
      </div>
    </div>
  );
}

function RedirectRulesTab({ partnerId }: { partnerId: string }) {
  const [rules, setRules] = useState<RedirectRule[]>([]);
  const [form, setForm] = useState({ match_type: "country" as RedirectRule["match_type"], match_value: "", target_url: "", priority: 0 });
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("partner_redirect_rules").select("*").eq("partner_id", partnerId).order("priority", { ascending: true });
    setRules((data as RedirectRule[]) ?? []);
  };
  useEffect(() => { load(); }, [partnerId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.match_value.trim() || !isValidHttpUrl(form.target_url)) { setError("Qiymat va to'g'ri URL kiriting."); return; }
    const { error: insertError } = await supabase.from("partner_redirect_rules").insert({
      partner_id: partnerId, match_type: form.match_type, match_value: form.match_value.trim(),
      target_url: form.target_url.trim(), priority: Number(form.priority) || 0,
    });
    if (insertError) { setError(insertError.message); return; }
    setForm({ match_type: "country", match_value: "", target_url: "", priority: 0 });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("partner_redirect_rules").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <p className="text-[11px] text-[#5b6f85] mb-3 leading-relaxed">
        Qoida topilmasa, mobil/planshet uchun Deep Link (agar kiritilgan bo'lsa), aks holda standart Affiliate URL ishlatiladi.
      </p>
      <form onSubmit={add} className="rounded-lg border border-white/8 p-4 mb-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className={inputCls} value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value as any })}>
            <option value="country">Mamlakat</option>
            <option value="language">Til</option>
            <option value="device">Qurilma</option>
          </select>
          <input className={inputCls} placeholder={form.match_type === "device" ? "mobile/desktop/tablet" : form.match_type === "country" ? "UZ" : "uz"} value={form.match_value} onChange={(e) => setForm({ ...form, match_value: e.target.value })} />
          <input type="number" className={inputCls} placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
        </div>
        <input className={inputCls} placeholder="Target URL (https://...)" value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} />
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold">Qoida qo'shish</button>
      </form>

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/8 p-3">
            <div className="text-[12px]">
              <span className="font-medium capitalize">{r.match_type}</span> = <span className="font-mono">{r.match_value}</span>
              <span className="text-[#5b6f85]"> → {r.target_url}</span>
            </div>
            <button onClick={() => remove(r.id)} className="p-1 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={13} /></button>
          </div>
        ))}
        {rules.length === 0 && <p className="text-[12px] text-[#5b6f85] text-center py-4">Hozircha maxsus qoida yo'q — standart URL ishlatiladi.</p>}
      </div>
    </div>
  );
}

function LinkHealthTab({ partner, onChecked }: { partner: Partner; onChecked: (p: Partner) => void }) {
  const [checking, setChecking] = useState(false);
  const supabase = createClient();

  const FIELDS: { key: string; label: string }[] = [
    { key: "website_url", label: "Website" },
    { key: "affiliate_url", label: "Affiliate URL" },
    { key: "apk_url", label: "APK" },
    { key: "google_play_url", label: "Google Play" },
    { key: "app_store_url", label: "App Store" },
  ];

  const runCheck = async () => {
    setChecking(true);
    await fetch("/api/admin/affiliates/check-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: partner.id }),
    });
    const { data } = await supabase.from("affiliate_partners").select("*").eq("id", partner.id).single();
    if (data) onChecked(data as Partner);
    setChecking(false);
  };

  const statusLabel: Record<string, string> = { ok: "Ishlayapti", broken: "Buzilgan", redirect_loop: "Redirect tsikli", invalid: "Noto'g'ri format" };
  const statusColor: Record<string, string> = {
    ok: "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30",
    broken: "bg-[#FF3B5C]/10 text-[#FF6B85] border-[#FF3B5C]/30",
    redirect_loop: "bg-vip/10 text-vip border-vip/30",
    invalid: "bg-[#FF3B5C]/10 text-[#FF6B85] border-[#FF3B5C]/30",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] text-[#5b6f85]">
          {partner.link_health_checked_at ? `Oxirgi tekshiruv: ${new Date(partner.link_health_checked_at).toLocaleString()}` : "Hali tekshirilmagan."}
        </p>
        <button onClick={runCheck} disabled={checking} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold disabled:opacity-60">
          {checking ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />} {checking ? "Tekshirilmoqda…" : "Havolalarni tekshirish"}
        </button>
      </div>
      <div className="space-y-2">
        {FIELDS.map((f) => {
          const result = partner.link_health?.[f.key];
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border border-white/8 p-3">
              <span className="text-[12px]">{f.label}</span>
              {result ? (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusColor[result.status]}`}>{statusLabel[result.status] ?? result.status}</span>
              ) : (
                <span className="text-[11px] text-[#5b6f85]">Tekshirilmagan</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
