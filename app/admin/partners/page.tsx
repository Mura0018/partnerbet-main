"use client";

import React, { useEffect, useState } from "react";
import { Building2, Plus, X, Loader2, Pencil, Trash2, Percent, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Partner = {
  id: string;
  name: string;
  company: string | null;
  status: "active" | "suspended" | "pending";
  billing_model: "commission" | "subscription";
  commission_pct: number;
  subscription_amount: number;
  currency: string;
  contact: string | null;
  created_at: string;
};

const CURRENCIES = ["UZS", "USD", "RUB", "EUR", "KZT", "TRY"];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Faol", cls: "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" },
  pending: { label: "Kutilmoqda", cls: "bg-[#F4C76A]/10 text-[#F4C76A] border-[#F4C76A]/30" },
  suspended: { label: "To'xtatilgan", cls: "bg-[#FF6B85]/10 text-[#FF6B85] border-[#FF6B85]/30" },
};

function fmtNum(n: number) {
  return Number(n || 0).toLocaleString("ru-RU");
}

function PartnerModal({ partner, onClose, onSaved }: { partner: Partner | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!partner;
  const [name, setName] = useState(partner?.name ?? "");
  const [company, setCompany] = useState(partner?.company ?? "");
  const [contact, setContact] = useState(partner?.contact ?? "");
  const [currency, setCurrency] = useState(partner?.currency ?? "UZS");
  const [status, setStatus] = useState<Partner["status"]>(partner?.status ?? "active");
  const [billing, setBilling] = useState<Partner["billing_model"]>(partner?.billing_model ?? "commission");
  const [commission, setCommission] = useState(partner ? String(partner.commission_pct) : "");
  const [subscription, setSubscription] = useState(partner ? String(partner.subscription_amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Hamkor nomini kiriting."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      company: company.trim() || null,
      contact: contact.trim() || null,
      currency,
      status,
      billing_model: billing,
      commission_pct: billing === "commission" ? Number(commission) || 0 : 0,
      subscription_amount: billing === "subscription" ? Number(subscription) || 0 : 0,
    };
    let errMsg: string | null = null;
    if (editing) {
      const { error } = await supabase.from("partners").update(payload).eq("id", partner!.id);
      errMsg = error?.message ?? null;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("partners").insert({ ...payload, created_by: user?.id ?? null });
      errMsg = error?.message ?? null;
    }
    setSaving(false);
    if (errMsg) { setError("Saqlashda xatolik: " + errMsg); return; }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">{editing ? "Hamkorni tahrirlash" : "Yangi hamkor"}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className="block text-[12px] text-muted mb-1">Hamkor nomi *</label>
            <input className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Kompaniya</label>
            <input className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder="1xbet" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Valyuta</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">Kontakt (ixtiyoriy)</label>
          <input className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder="Telegram / telefon" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1.5">To'lov modeli</label>
          <div className="flex gap-1.5 mb-2">
            {(["commission", "subscription"] as const).map((b) => (
              <button key={b} type="button" onClick={() => setBilling(b)}
                className={`flex-1 py-2 rounded-lg text-[12.5px] font-medium border ${billing === b ? "bg-accent/20 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}>
                {b === "commission" ? "Komissiya (%)" : "Obuna"}
              </button>
            ))}
          </div>
          {billing === "commission" ? (
            <input type="number" step="0.01" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder="Komissiya foizi, masalan 5" value={commission} onChange={(e) => setCommission(e.target.value)} />
          ) : (
            <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder={`Obuna to'lovi (${currency})`} value={subscription} onChange={(e) => setSubscription(e.target.value)} />
          )}
        </div>

        <div className="mb-5">
          <label className="block text-[12px] text-muted mb-1">Holat</label>
          <select className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" value={status} onChange={(e) => setStatus(e.target.value as Partner["status"])}>
            <option value="active">Faol</option>
            <option value="pending">Kutilmoqda</option>
            <option value="suspended">To'xtatilgan</option>
          </select>
        </div>

        {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}

        <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin mx-auto" /> : editing ? "Saqlash" : "Yaratish"}
        </button>
      </form>
    </div>
  );
}

export default function PartnersManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
    setPartners((data as Partner[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (p: Partner) => {
    if (!confirm(`"${p.name}" hamkorini butunlay o'chirishni tasdiqlaysizmi? Uning a'zolari, API'lari va chati ham o'chadi.`)) return;
    const { error } = await supabase.from("partners").delete().eq("id", p.id);
    if (error) alert("O'chirishda xatolik: " + error.message);
    else load();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-accent" />
          <h1 className="text-[22px] font-bold">Hamkorlar</h1>
        </div>
        <button onClick={() => setModal({ open: true, partner: null })} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Yangi hamkor
        </button>
      </div>
      <p className="text-[13px] text-muted mb-6">Hamkor kompaniyalar — o'z panel, API va xodimlari bilan ishlaydi. Siz komissiya/obuna orqali daromad olasiz.</p>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : partners.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          Hozircha hamkor yo'q. "Yangi hamkor" tugmasi orqali qo'shing.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {partners.map((p) => {
            const st = STATUS_META[p.status] ?? STATUS_META.pending;
            return (
              <div key={p.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold truncate">{p.name}</div>
                    {p.company && <div className="text-[11px] text-muted truncate">{p.company}</div>}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] border ${st.cls}`}>{st.label}</span>
                </div>

                <div className="flex items-center gap-3 text-[12px] text-muted mb-3">
                  <span className="flex items-center gap-1">
                    {p.billing_model === "commission"
                      ? <><Percent size={12} /> {p.commission_pct}%</>
                      : <><CalendarClock size={12} /> {fmtNum(p.subscription_amount)} {p.currency}</>}
                  </span>
                  <span className="text-[#5b6f85]">·</span>
                  <span>{p.currency}</span>
                </div>

                <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-white/5">
                  <button onClick={() => setModal({ open: true, partner: p })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-[11.5px] text-muted hover:text-white">
                    <Pencil size={13} /> Tahrirlash
                  </button>
                  <button onClick={() => remove(p)} className="ml-auto p-1.5 rounded-md hover:bg-[#FF6B85]/10 text-[#FF6B85]" aria-label="O'chirish" title="O'chirish">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && <PartnerModal partner={modal.partner} onClose={() => setModal({ open: false, partner: null })} onSaved={load} />}
    </div>
  );
}
