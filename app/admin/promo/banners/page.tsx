"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "@/lib/ui/toast";

type Banner = { id: string; title: string | null; subtitle: string | null; image_url: string | null; link_url: string | null; is_active: boolean; sort: number };

const inp = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm outline-none focus:border-accent";

// 10 ta tayyor shablon — bosilганда formani to'ldiradi (havolani admin qo'yadi).
const TEMPLATES: { title: string; subtitle: string }[] = [
  { title: "1xBet — ro'yxatdan o'ting", subtitle: "Yangi hisob oching va o'ynang" },
  { title: "Melbet bonus", subtitle: "Birinchi depozitga 100% bonus" },
  { title: "100% xush kelibsiz bonusi", subtitle: "Depozitingiz ikki barobar" },
  { title: "Bepul basketbol/futbol", subtitle: "Jonli o'yinlarga tiking" },
  { title: "Kunlik keshbek", subtitle: "Har kuni pul qaytarib oling" },
  { title: "Do'stni taklif qiling", subtitle: "Har taklif uchun bonus" },
  { title: "VIP dastur", subtitle: "Ko'proq o'yna — ko'proq yut" },
  { title: "Tezkor to'ldirish", subtitle: "BetCore Pay bilan bir zumda" },
  { title: "Sovrinli aksiya", subtitle: "Faol bo'ling — katta sovrinlar" },
  { title: "Mobil ilova", subtitle: "Istalgan joyda o'ynang" },
];

const empty: Partial<Banner> = { title: "", subtitle: "", image_url: "", link_url: "", is_active: true, sort: 0 };

export default function PromoBannersPage() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Banner> | null>(null);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo/banners", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { toast.error("Saqlanmadi"); return; }
      toast.success("Saqlandi ✅");
      setForm(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Banner o'chirilsinmi?")) return;
    const res = await fetch(`/api/admin/promo/banners?id=${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("O'chirildi"); load(); }
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
            <h1 className="text-lg font-semibold text-white">Reklama bannerlari</h1>
            <p className="text-xs text-white/40">Mijoz app pastida almashib turadi</p>
          </div>
        </div>
        <button onClick={() => setForm({ ...empty })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#F4C76A] text-[#2a1e05]"><Plus size={16} /> Yangi</button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-14 text-white/40 text-sm border border-white/10 rounded-2xl">Hozircha banner yo'q. "Yangi" bilan qo'shing.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              {b.image_url ? <img src={b.image_url} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-16 h-10 rounded-lg bg-white/5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-white text-[13px] font-semibold truncate">{b.title || "—"}</div>
                <div className="text-white/40 text-[11px] truncate">{b.subtitle || b.link_url || ""}</div>
              </div>
              <button onClick={() => toggle(b)} className={`shrink-0 text-[10px] px-2 py-1 rounded-full border ${b.is_active ? "bg-[#4ADE80]/10 border-[#4ADE80]/30 text-[#4ADE80]" : "bg-white/5 border-white/10 text-white/40"}`}>{b.is_active ? "Aktiv" : "O'chiq"}</button>
              <button onClick={() => setForm(b)} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/60"><Pencil size={15} /></button>
              <button onClick={() => remove(b.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-[#FF6B85]/10 text-[#FF6B85]"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && setForm(null)}>
          <div className="bg-[#0E1518] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">{form.id ? "Bannerni tahrirlash" : "Yangi banner"}</h2>
              <button onClick={() => setForm(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/50"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <span className="block text-[11px] text-white/40 mb-1.5">Tayyor shablonlar</span>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t, i) => (
                    <button key={i} onClick={() => setForm((f) => ({ ...f, title: t.title, subtitle: t.subtitle }))} className="text-[10.5px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-accent/40">{t.title}</button>
                  ))}
                </div>
              </div>
              <div><span className="block text-[11px] text-white/40 mb-1">Sarlavha</span><input className={inp} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><span className="block text-[11px] text-white/40 mb-1">Matn (subtitle)</span><input className={inp} value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
              <div><span className="block text-[11px] text-white/40 mb-1">Rasm URL (AI/Media'дан)</span><input className={inp} value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
              {form.image_url ? <img src={form.image_url} alt="" className="w-full h-28 object-cover rounded-lg" /> : null}
              <div><span className="block text-[11px] text-white/40 mb-1">Havola (bosilganда ochiladi)</span><input className={inp} value={form.link_url ?? ""} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://1xbet... yoki t.me/..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="block text-[11px] text-white/40 mb-1">Tartib (kichik = oldin)</span><input type="number" className={inp} value={form.sort ?? 0} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} /></div>
                <label className="flex items-end gap-2 text-sm text-white/70 pb-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[#1CE0C3]" /> Aktiv
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
              <button onClick={() => setForm(null)} disabled={saving} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:bg-white/5">Bekor</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#F4C76A] text-[#2a1e05] disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
