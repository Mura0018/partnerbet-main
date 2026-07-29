"use client";

import React, { useEffect, useState } from "react";
import { Receipt, Loader2, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Select } from "@/lib/ui/Select";

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
const PERIOD_KEY: Record<string, string> = { monthly: "trf.monthly", one_time: "trf.oneTime" };

function TariffRow({ tf, onSaved }: { tf: Tariff; onSaved: () => void }) {
  const { t } = useLocale();
  const [price, setPrice] = useState(String(tf.price));
  const [currency, setCurrency] = useState(tf.currency);
  const [active, setActive] = useState(tf.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  const dirty = price !== String(tf.price) || currency !== tf.currency || active !== tf.is_active;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("tariffs")
      .update({ price: Number(price) || 0, currency, is_active: active, updated_at: new Date().toISOString() })
      .eq("id", tf.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved(); toast.success(t("trf.tSaved", { name: tf.name })); }
    else toast.error(t("trf.tSaveErr") + error.message);
  };

  return (
    <div className="rounded-xl glass-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[14px] font-bold">{tf.name}</div>
          <div className="text-[11px] text-muted mt-0.5">{PERIOD_KEY[tf.period] ? t(PERIOD_KEY[tf.period] as any) : tf.period} · <span className="font-mono">{tf.key}</span></div>
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-muted cursor-pointer shrink-0">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-accent" />
          {t("trf.active")}
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <div>
          <label className="block text-[10.5px] text-[#5b6f85] mb-1">{t("trf.price")}</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-40 bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-[10.5px] text-[#5b6f85] mb-1">{t("trf.currency")}</label>
          <Select
            className="bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] flex items-center justify-between gap-2"
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <button onClick={save} disabled={!dirty || saving} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><Check size={14} /> {t("trf.saved")}</> : t("trf.save")}
        </button>
      </div>
    </div>
  );
}

export default function TariffsManager() {
  const { t } = useLocale();
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
        <h1 className="text-[22px] font-bold">{t("trf.title")}</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">{t("trf.sub")}</p>

      {loading ? (
        <p className="text-[13px] text-muted">{t("trf.loading")}</p>
      ) : missing ? (
        <div className="rounded-xl border border-[#F4C76A]/30 bg-[#F4C76A]/10 p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#F4C76A] shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <div className="font-semibold text-[#F4C76A] mb-1">{t("trf.missingTitle")}</div>
            <div className="text-muted">{t("trf.missingPre")}<span className="font-mono">0060_partner_bot_themes_tariffs.sql</span>{t("trf.missingPost")}</div>
          </div>
        </div>
      ) : tariffs.length === 0 ? (
        <div className="rounded-xl glass-card p-8 text-center text-[13px] text-muted">{t("trf.empty")}</div>
      ) : (
        <div className="space-y-3">
          {tariffs.map((tf) => <TariffRow key={tf.id} tf={tf} onSaved={load} />)}
        </div>
      )}
    </div>
  );
}
