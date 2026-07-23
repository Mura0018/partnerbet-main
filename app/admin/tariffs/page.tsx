"use client";

import React, { useEffect, useState } from "react";
import { Receipt, Loader2, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";

type Tariff = {
  id: string;
  key: string;
  name: string;
  price: number;
  currency: string;
  period: "monthly" | "one_time";
  is_active: boolean;
};

const CURRENCIES = ["UZS", "USD", "RUB", "EUR", "KZT", "TRY"];
const PERIOD_LABEL: Record<string, string> = { monthly: "oylik", one_time: "bir martalik" };

function TariffRow({ t, onSaved }: { t: Tariff; onSaved: () => void }) {
  const [price, setPrice] = useState(String(t.price));
  const [currency, setCurrency] = useState(t.currency);
  const [active, setActive] = useState(t.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  const dirty = price !== String(t.price) || currency !== t.currency || active !== t.is_active;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("tariffs")
      .update({ price: Number(price) || 0, currency, is_active: active, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved(); toast.success(`"${t.name}" narxi saqlandi ✅`); }
    else toast.error("Saqlashda xatolik: " + error.message);
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[14px] font-bold">{t.name}</div>
          <div className="text-[11px] text-muted mt-0.5">{PERIOD_LABEL[t.period] ?? t.period} · <span className="font-mono">{t.key}</span></div>
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-muted cursor-pointer shrink-0">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-accent" />
          Faol
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <div>
          <label className="block text-[10.5px] text-[#5b6f85] mb-1">Narx</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-40 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-[10.5px] text-[#5b6f85] mb-1">Valyuta</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={save} disabled={!dirty || saving} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><Check size={14} /> Saqlandi</> : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

export default function TariffsManager() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tariffs").select("*").order("period").order("name");
    if (error) { setMissing(true); setTariffs([]); }
    else { setMissing(false); setTariffs((data as Tariff[]) ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Tariflar</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">Premium tema, obuna va boshqa xizmat narxlari. Bir marta belgilaysiz — barcha hamkorlarga amal qiladi.</p>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : missing ? (
        <div className="rounded-xl border border-[#F4C76A]/30 bg-[#F4C76A]/10 p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#F4C76A] shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <div className="font-semibold text-[#F4C76A] mb-1">Tariflar jadvali topilmadi</div>
            <div className="text-muted">Iltimos <span className="font-mono">0060_partner_bot_themes_tariffs.sql</span> migratsiyasini Supabase'da ishga tushiring, so'ng sahifani yangilang.</div>
          </div>
        </div>
      ) : tariffs.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">Tarif yo'q.</div>
      ) : (
        <div className="space-y-3">
          {tariffs.map((t) => <TariffRow key={t.id} t={t} onSaved={load} />)}
        </div>
      )}
    </div>
  );
}
