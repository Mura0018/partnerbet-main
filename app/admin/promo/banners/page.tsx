"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Loader2, Plus, Trash2, Pencil, X, Check, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "@/lib/ui/toast";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/lib/ui/useConfirm";

type Banner = { id: string; title: string | null; subtitle: string | null; image_url: string | null; link_url: string | null; is_active: boolean; sort: number };

const inp = "w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-white text-sm outline-none focus:border-accent";

const empty: Partial<Banner> = { title: "", subtitle: "", image_url: "", link_url: "", is_active: true, sort: 0 };

// Maydon sarlavhasi — nom + majburiy/ixtiyoriy belgi + izoh.
function FieldHead({ label, required, hint, reqText, optText }: { label: string; required?: boolean; hint?: string; reqText: string; optText: string }) {
  return (
    <div className="mb-1">
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-[12px] text-white/75 truncate">{label}</span>
        <span className={`text-[10px] font-medium whitespace-nowrap shrink-0 ${required ? "text-[#FF6B85]" : "text-white/30"}`}>· {required ? reqText : optText}</span>
      </span>
      {hint && <span className="block text-[10.5px] text-white/35 mt-0.5 leading-snug">{hint}</span>}
    </div>
  );
}

export default function PromoBannersPage() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Banner> | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<{ title?: boolean; link?: boolean }>({});
  const { confirm, confirmDialog } = useConfirm();

  // Formani ochish — har safar "tegildi" holatini tozalaymiz (xatolar
  // faqat maydonga tegilgandan keyin chiqadi, oyna ochilganda emas).
  const openForm = (f: Partial<Banner>) => { setTouched({}); setForm(f); };

  const load = async () => {
    try {
      const res = await fetch("/api/admin/promo/banners");
      const d = await res.json();
      if (res.ok) setRows(d.banners ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form) return;
    if (!form.title?.trim() || !form.link_url?.trim()) return; // Sarlavha + Havola majburiy
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo/banners", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { toast.error(t("prm.tSaveErr")); return; }
      toast.success(t("prm.tSaved"));
      setForm(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    confirm(t("prm.confirmDelete"), async () => {
      const res = await fetch(`/api/admin/promo/banners?id=${id}`, { method: "DELETE" });
      if (res.ok) { toast.success(t("prm.tDeleted")); load(); }
    });
  };

  const toggle = async (b: Banner) => {
    await fetch("/api/admin/promo/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, is_active: !b.is_active }) });
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-[#F4C76A]/10 text-[#F4C76A]"><Megaphone size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold text-white">{t("prm.bannersTitle")}</h1>
            <p className="text-xs text-white/40">{t("prm.bannersSub")}</p>
          </div>
        </div>
        <button onClick={() => openForm({ ...empty })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#F4C76A] text-[#2a1e05]"><Plus size={16} /> {t("prm.newBtn")}</button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-14 text-white/40 text-sm border border-subtle rounded-2xl">{t("prm.emptyBanners")}</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
              {b.image_url ? <img src={b.image_url} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-16 h-10 rounded-lg bg-white/5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-white text-[13px] font-semibold truncate">{b.title || "—"}</div>
                <div className="text-white/40 text-[11px] truncate">{b.subtitle || b.link_url || ""}</div>
              </div>
              <button onClick={() => toggle(b)} className={`shrink-0 text-[10px] px-2 py-1 rounded-full border ${b.is_active ? "bg-[#4ADE80]/10 border-[#4ADE80]/30 text-[#4ADE80]" : "bg-white/5 border-subtle text-white/40"}`}>{b.is_active ? t("prm.active") : t("prm.offShort")}</button>
              <button onClick={() => openForm(b)} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/60"><Pencil size={15} /></button>
              <button onClick={() => remove(b.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-[#FF6B85]/10 text-[#FF6B85]"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && setForm(null)}>
          <div className="bg-[#0E1518] border border-subtle rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
              <h2 className="text-white font-semibold">{form.id ? t("prm.editBanner") : t("prm.newBanner")}</h2>
              <button onClick={() => setForm(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/50"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Oldindan ko'rish — mijoz app'da aynan shunday chiqadi */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-white/75">{t("prm.previewTitle")}</span>
                  <span className="text-[10.5px] text-white/35">{t("prm.previewSub")}</span>
                </div>
                <div className="relative w-full overflow-hidden rounded-2xl" style={{ minHeight: 96, boxShadow: "0 10px 26px rgba(0,0,0,0.45)" }}>
                  {form.image_url?.trim() ? (
                    <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: "linear-gradient(120deg,#132033,#0E1826,#7c3aed)" }} />
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(4,10,24,0.82),rgba(4,10,24,0.35))" }} />
                  <div className="relative px-4 py-3.5 flex items-center gap-3 min-h-[96px]">
                    <div className="min-w-0 flex-1">
                      <div className={`text-[15px] font-extrabold truncate ${form.title?.trim() ? "text-white" : "text-white/40"}`}>{form.title?.trim() || t("prm.fTitle")}</div>
                      {form.subtitle?.trim() && <div className="text-[11.5px] text-white/75 mt-0.5 truncate">{form.subtitle}</div>}
                    </div>
                    <ArrowRight size={18} className="shrink-0 text-white/80" />
                  </div>
                </div>
                {!form.image_url?.trim() && <p className="text-[10.5px] text-white/35 mt-1.5">{t("prm.noImgNote")}</p>}
              </div>

              {/* Sarlavha — MAJBURIY */}
              <div>
                <FieldHead label={t("prm.fTitle")} required hint={t("prm.fTitleHint")} reqText={t("prm.reqMark")} optText={t("prm.optMark")} />
                <input className={inp} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} onBlur={() => setTouched((p) => ({ ...p, title: true }))} placeholder="1xBet — ro'yxatdan o'ting" />
                {touched.title && !form.title?.trim() && <p className="flex items-center gap-1 text-[10.5px] text-[#FF6B85] mt-1"><AlertCircle size={11} /> {t("prm.titleReq")}</p>}
              </div>

              {/* Havola — MAJBURIY */}
              <div>
                <FieldHead label={t("prm.fLink")} required hint={t("prm.fLinkHint")} reqText={t("prm.reqMark")} optText={t("prm.optMark")} />
                <input className={inp} value={form.link_url ?? ""} onChange={(e) => setForm({ ...form, link_url: e.target.value })} onBlur={() => setTouched((p) => ({ ...p, link: true }))} placeholder="https://1xbet... yoki t.me/..." />
                {touched.link && !form.link_url?.trim() && <p className="flex items-center gap-1 text-[10.5px] text-[#FF6B85] mt-1"><AlertCircle size={11} /> {t("prm.linkReq")}</p>}
              </div>

              {/* Rasm URL — ixtiyoriy */}
              <div>
                <FieldHead label={t("prm.fImage")} hint={t("prm.fImageHint")} reqText={t("prm.reqMark")} optText={t("prm.optMark")} />
                <input className={inp} value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>

              {/* Izoh — ixtiyoriy */}
              <div>
                <FieldHead label={t("prm.fSubtitle")} hint={t("prm.fSubtitleHint")} reqText={t("prm.reqMark")} optText={t("prm.optMark")} />
                <input className={inp} value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>

              {/* Tartib + Aktiv */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldHead label={t("prm.fOrder")} hint={t("prm.fOrderHint")} reqText={t("prm.reqMark")} optText={t("prm.optMark")} />
                  <input type="number" className={inp} value={form.sort ?? 0} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} />
                </div>
                <label className="flex items-end gap-2 text-sm text-white/70 pb-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[#1CE0C3]" /> {t("prm.fActive")}
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-subtle">
              <button onClick={() => setForm(null)} disabled={saving} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:bg-white/5">{t("prm.cancel")}</button>
              <button onClick={save} disabled={saving || !form.title?.trim() || !form.link_url?.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#F4C76A] text-[#2a1e05] disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t("prm.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
