"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Upload, Loader2, Search, Copy, CheckSquare, Square } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/media/upload";
import { isValidHttpUrl } from "@/lib/validation/url";

type Banner = {
  id: string;
  kind: "image" | "embed";
  placement: string;
  banner_size: string | null;
  image_url: string | null;
  embed_code: string | null;
  target_url: string | null;
  partner_id: string | null;
  target_countries: string[] | null;
  target_languages: string[] | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  clicks: number;
  views: number;
};

type Partner = { id: string; name: string; slug: string };

const PLACEMENTS = ["homepage", "blog", "insights", "football_news", "apk_page", "popup", "sticky", "sidebar", "footer", "header"];
const BANNER_SIZES = ["desktop", "tablet", "mobile", "square", "popup", "sticky", "hero"];
const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

const EMPTY = {
  kind: "image" as "image" | "embed", placement: "homepage", banner_size: "desktop",
  content: "", target_url: "", partner_id: "", countriesInput: "", languages: [] as string[],
  starts_at: "", ends_at: "",
};

export default function BannersManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlacement, setFilterPlacement] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  const load = async () => {
    const [{ data: bannersData }, { data: partnersData }] = await Promise.all([
      supabase.from("advertisements").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("affiliate_partners").select("id, name, slug").is("deleted_at", null).order("name"),
    ]);
    setBanners((bannersData as Banner[]) ?? []);
    setPartners((partnersData as Partner[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const totalViews = banners.reduce((s, b) => s + (b.views || 0), 0);
  const totalClicks = banners.reduce((s, b) => s + (b.clicks || 0), 0);
  const overallCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
  const now = new Date();
  const isExpired = (b: Banner) => !!b.ends_at && new Date(b.ends_at) <= now;
  const isScheduled = (b: Banner) => !!b.starts_at && new Date(b.starts_at) > now;
  const activeCount = banners.filter((b) => b.is_active && !isExpired(b) && !isScheduled(b)).length;
  const expiredCount = banners.filter(isExpired).length;
  const scheduledCount = banners.filter(isScheduled).length;
  const ranked = banners.filter((b) => b.views >= 20).map((b) => ({ ...b, ctr: (b.clicks / b.views) * 100 })).sort((a, c) => c.ctr - a.ctr);
  const topBanner = ranked[0];
  const worstBanner = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  const toggleLanguage = (lang: string) => {
    setForm((prev) => ({ ...prev, languages: prev.languages.includes(lang) ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang] }));
  };

  const handleFileSelect = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const media = await uploadImage(file);
      setForm((prev) => ({ ...prev, content: media.publicUrl }));
    } catch (e: any) {
      setError(e.message ?? "Yuklashda xatolik.");
    } finally {
      setUploading(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.target_url && !isValidHttpUrl(form.target_url)) { setError("Target URL noto'g'ri."); return; }
    if (!form.content.trim()) { setError(form.kind === "image" ? "Rasm yuklang." : "Kodni kiriting."); return; }

    const payload: any = {
      kind: form.kind,
      placement: form.placement,
      banner_size: form.banner_size,
      target_url: form.target_url.trim() || null,
      partner_id: form.partner_id || null,
      target_countries: form.countriesInput.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
      target_languages: form.languages,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    if (form.kind === "image") payload.image_url = form.content;
    else payload.embed_code = form.content;

    const { error: insertError } = await supabase.from("advertisements").insert(payload);
    if (insertError) { setError(insertError.message); return; }
    setForm(EMPTY);
    load();
  };

  const toggle = async (b: Banner) => {
    await supabase.from("advertisements").update({ is_active: !b.is_active }).eq("id", b.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("O'chirilsinmi?")) return;
    await supabase.from("advertisements").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const partnerName = (id: string | null) => partners.find((p) => p.id === id)?.name;

  const filteredBanners = banners.filter((b) => {
    if (filterPlacement && b.placement !== filterPlacement) return false;
    if (filterKind && b.kind !== filterKind) return false;
    if (filterStatus === "active" && !(b.is_active && !isExpired(b) && !isScheduled(b))) return false;
    if (filterStatus === "expired" && !isExpired(b)) return false;
    if (filterStatus === "scheduled" && !isScheduled(b)) return false;
    if (filterStatus === "inactive" && b.is_active) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [b.placement, b.banner_size, b.kind, partnerName(b.partner_id), b.target_url].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBanners.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredBanners.map((b) => b.id)));
  };
  const bulkSetActive = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    await supabase.from("advertisements").update({ is_active: active }).in("id", Array.from(selectedIds));
    setSelectedIds(new Set());
    load();
  };
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} ta banner o'chirilsinmi?`)) return;
    await supabase.from("advertisements").update({ deleted_at: new Date().toISOString() }).in("id", Array.from(selectedIds));
    setSelectedIds(new Set());
    load();
  };
  const clone = async (b: Banner) => {
    const { id, views, clicks, ...rest } = b;
    await supabase.from("advertisements").insert({ ...rest, is_active: false, views: 0, clicks: 0 });
    load();
  };

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold mb-1">Banner Manager</h1>
      <p className="text-[13px] text-muted mb-6">Har qanday o'lchamdagi bannerlar — yuklash, maqsadlash, rejalashtirish.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[20px] font-bold">{totalViews.toLocaleString()}</div>
          <div className="text-[11px] text-muted mt-1">Jami ko'rishlar</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[20px] font-bold">{totalClicks.toLocaleString()}</div>
          <div className="text-[11px] text-muted mt-1">Jami kliklar</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[20px] font-bold">{overallCtr.toFixed(2)}%</div>
          <div className="text-[11px] text-muted mt-1">Umumiy CTR</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[20px] font-bold">{banners.length}</div>
          <div className="text-[11px] text-muted mt-1">Jami bannerlar</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-2">Holat</div>
          <div className="flex items-center justify-between text-[12px] mb-1"><span>Faol</span><span className="text-[#17C964] font-semibold">{activeCount}</span></div>
          <div className="flex items-center justify-between text-[12px] mb-1"><span>Rejalashtirilgan</span><span className="text-accent font-semibold">{scheduledCount}</span></div>
          <div className="flex items-center justify-between text-[12px]"><span>Muddati tugagan</span><span className="text-[#FF6B85] font-semibold">{expiredCount}</span></div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-2">Eng yaxshi ishlagan (20+ ko'rish)</div>
          {topBanner ? (
            <>
              <div className="text-[13px] font-semibold">{partnerName(topBanner.partner_id) ?? topBanner.placement}</div>
              <div className="text-[11px] text-[#5b6f85] mt-1">{topBanner.ctr.toFixed(2)}% CTR · {topBanner.views} ko'rish · {topBanner.clicks} klik</div>
            </>
          ) : (
            <p className="text-[11px] text-[#5b6f85]">Hali yetarli ma'lumot yo'q.</p>
          )}
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-2">Eng past ishlagan (20+ ko'rish)</div>
          {worstBanner ? (
            <>
              <div className="text-[13px] font-semibold">{partnerName(worstBanner.partner_id) ?? worstBanner.placement}</div>
              <div className="text-[11px] text-[#5b6f85] mt-1">{worstBanner.ctr.toFixed(2)}% CTR · {worstBanner.views} ko'rish · {worstBanner.clicks} klik</div>
            </>
          ) : (
            <p className="text-[11px] text-[#5b6f85]">Hali yetarli ma'lumot yo'q.</p>
          )}
        </div>
      </div>

      <form onSubmit={add} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })} className={inputCls}>
            <option value="image">Rasm banner</option>
            <option value="embed">HTML/JS kod</option>
          </select>
          <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} className={inputCls}>
            {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={form.banner_size} onChange={(e) => setForm({ ...form, banner_size: e.target.value })} className={inputCls}>
            {BANNER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {form.kind === "image" ? (
          <div className="flex items-center gap-3">
            {form.content && <img src={form.content} alt="" className="w-14 h-14 rounded-lg object-cover border border-white/10" />}
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[12px] cursor-pointer hover:bg-white/5">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Rasm yuklash
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            </label>
          </div>
        ) : (
          <textarea rows={4} placeholder="Hamkordan olingan HTML/JS kod" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className={`${inputCls} font-mono`} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="Target URL (ixtiyoriy — /go/hamkor-slug tavsiya etiladi)" value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} className={inputCls} />
          <select value={form.partner_id} onChange={(e) => setForm({ ...form, partner_id: e.target.value })} className={inputCls}>
            <option value="">— hamkor tanlanmagan —</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="Mamlakatlar (UZ, RU — bo'sh = hammasi)" value={form.countriesInput} onChange={(e) => setForm({ ...form, countriesInput: e.target.value })} className={inputCls} />
          <div className="flex gap-2 items-center">
            {["uz", "ru", "en"].map((l) => (
              <button key={l} type="button" onClick={() => toggleLanguage(l)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border uppercase ${form.languages.includes(l) ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-muted mb-1">Boshlanish sanasi</label>
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">Tugash sanasi</label>
            <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inputCls} />
          </div>
        </div>

        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Banner qo'shish
        </button>
      </form>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
          <input placeholder="Qidirish (joylashuv, hamkor, o'lcham...)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`${inputCls} pl-9`} />
        </div>
        <select value={filterPlacement} onChange={(e) => setFilterPlacement(e.target.value)} className={inputCls}>
          <option value="">Barcha joylashuvlar</option>
          {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className={inputCls}>
          <option value="">Barcha turlar</option>
          <option value="image">Rasm</option>
          <option value="embed">HTML/JS kod</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="inactive">O'chirilgan</option>
          <option value="scheduled">Rejalashtirilgan</option>
          <option value="expired">Muddati tugagan</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-xl border border-accent/30 bg-accent/10">
          <span className="text-[12px] font-medium">{selectedIds.size} ta tanlandi</span>
          <button onClick={() => bulkSetActive(true)} className="text-[12px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Yoqish</button>
          <button onClick={() => bulkSetActive(false)} className="text-[12px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">O'chirish (yashirish)</button>
          <button onClick={bulkDelete} className="text-[12px] px-3 py-1.5 rounded-lg bg-[#FF3B5C]/20 text-[#FF6B85] hover:bg-[#FF3B5C]/30">Butunlay o'chirish</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[12px] text-muted ml-auto">Bekor qilish</button>
        </div>
      )}

      {filteredBanners.length > 0 && (
        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-[12px] text-muted mb-2 hover:text-white">
          {selectedIds.size === filteredBanners.length ? <CheckSquare size={14} /> : <Square size={14} />}
          Barchasini tanlash
        </button>
      )}

      <div className="space-y-3">
        {filteredBanners.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="min-w-0 flex items-center gap-3">
              <button onClick={() => toggleSelect(b.id)} className="shrink-0 text-muted hover:text-white" aria-label="Tanlash">
                {selectedIds.has(b.id) ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
              </button>
              {b.image_url && <img src={b.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">{b.kind}</span>
                  <span className="text-muted">{b.placement}</span>
                  {b.banner_size && <span className="text-[#5b6f85]">· {b.banner_size}</span>}
                  {partnerName(b.partner_id) && <span className="text-[#5b6f85]">· {partnerName(b.partner_id)}</span>}
                  {isExpired(b) && <span className="text-[#FF6B85]">· muddati tugagan</span>}
                  {isScheduled(b) && <span className="text-accent">· rejalashtirilgan</span>}
                </div>
                <div className="text-[11px] text-[#5b6f85] mt-1">{b.views} views · {b.clicks} clicks</div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => clone(b)} className="p-2 rounded-md hover:bg-white/10 text-muted" aria-label="Nusxalash"><Copy size={15} /></button>
              <button onClick={() => toggle(b)} className="p-2 rounded-md hover:bg-white/10" aria-label={b.is_active ? "Yashirish" : "Ko'rsatish"}>
                {b.is_active ? <Eye size={15} /> : <EyeOff size={15} className="text-[#5b6f85]" />}
              </button>
              <button onClick={() => remove(b.id)} className="p-2 rounded-md hover:bg-white/10 text-[#FF6B85]" aria-label="O'chirish"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {filteredBanners.length === 0 && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-[#5b6f85]">
            {banners.length === 0 ? "Hozircha banner yo'q." : "Qidiruv/filtrlarga mos banner topilmadi."}
          </div>
        )}
      </div>
    </div>
  );
}
