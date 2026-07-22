"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";

type OperatorPaymentMethod = {
  id: string;
  method_type: "card" | "click" | "payme" | "crypto";
  account_number: string;
  holder_name: string | null;
  is_active: boolean;
  usage_count: number;
  usage_limit: number | null;
};

const METHOD_TYPE_LABELS: Record<OperatorPaymentMethod["method_type"], string> = {
  card: "Bank kartasi",
  click: "Click",
  payme: "Payme",
  crypto: "USDT (TRC20)",
};

export function MyPaymentMethodsTab() {
  const [methods, setMethods] = useState<OperatorPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ method_type: OperatorPaymentMethod["method_type"]; account_number: string; holder_name: string; usage_limit: string }>({
    method_type: "card", account_number: "", holder_name: "", usage_limit: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("telegram_operator_payment_methods")
      .select("id, method_type, account_number, holder_name, is_active, usage_count, usage_limit")
      .eq("operator_id", user.id)
      .order("method_type");
    setMethods((data as OperatorPaymentMethod[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_number.trim()) return;
    setSaving(true);
    setError(null);
    let opError: unknown = null;
    if (editingId) {
      const { error } = await supabase.from("telegram_operator_payment_methods").update({
        method_type: form.method_type,
        account_number: form.account_number.trim(),
        holder_name: form.holder_name.trim() || null,
        usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
      }).eq("id", editingId);
      opError = error;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("telegram_operator_payment_methods").insert({
          operator_id: user.id,
          method_type: form.method_type,
          account_number: form.account_number.trim(),
          holder_name: form.holder_name.trim() || null,
          usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
        });
        opError = error;
      } else {
        opError = new Error("no_user");
      }
    }
    setSaving(false);
    if (opError) {
      // Xato bo'lsa formani ochiq qoldiramiz — operator soxta "saqlandi" ko'rmasin.
      setError("Saqlashda xatolik yuz berdi. Qayta urinib ko'ring.");
      return;
    }
    setForm({ method_type: "card", account_number: "", holder_name: "", usage_limit: "" });
    setEditingId(null);
    setShowForm(false);
    load();
  };

  const startEdit = (m: OperatorPaymentMethod) => {
    setForm({ method_type: m.method_type, account_number: m.account_number, holder_name: m.holder_name ?? "", usage_limit: m.usage_limit != null ? String(m.usage_limit) : "" });
    setEditingId(m.id);
    setShowForm(true);
  };

  const startAdd = () => {
    setForm({ method_type: "card", account_number: "", holder_name: "", usage_limit: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const toggleActive = async (m: OperatorPaymentMethod) => {
    setError(null);
    const { error } = await supabase.from("telegram_operator_payment_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    if (error) { setError("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring."); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    setError(null);
    const { error } = await supabase.from("telegram_operator_payment_methods").delete().eq("id", id);
    if (error) { setError("O'chirib bo'lmadi. Qayta urinib ko'ring."); return; }
    load();
  };

  if (loading) return <p className="text-[13px] text-muted">Yuklanmoqda...</p>;

  return (
    <div className="max-w-lg">
      <p className="text-[12px] text-muted mb-4 leading-relaxed">
        Bu — sizning shaxsiy to'lov rekvizitlaringiz. Mijoz Mini App'da hisob to'ldirishni tanlaganda, faol
        rekvizitlar orasidan tasodifiy biri ko'rsatiladi — shu bilan to'lovlar operatorlar orasida taqsimlanadi.
        Rekvizitni istalgan vaqt tahrirlab (masalan har kuni boshqa kartaga) almashtira olasiz.
      </p>

      {error && (
        <p className="text-[12px] text-[#FF6B85] bg-[#FF6B85]/10 border border-[#FF6B85]/30 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {methods.length === 0 && !showForm && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 text-center text-[13px] text-muted mb-4">
          Hali rekvizit qo'shmagansiz.
        </div>
      )}

      <div className="flex flex-col gap-5 mb-5">
        {methods.map((m) => (
          <div key={m.id}>
            <LuxuryCard
              typeLabel={METHOD_TYPE_LABELS[m.method_type]}
              number={m.account_number}
              holderName={m.holder_name}
              active={m.is_active}
              onToggleActive={() => toggleActive(m)}
              onEdit={() => startEdit(m)}
              onDelete={() => remove(m.id)}
            />
            {m.usage_limit != null && (
              <div className="text-[11px] text-muted mt-1.5 max-w-[340px]">
                Ishlatilgan: <span className={m.usage_count >= m.usage_limit ? "text-[#FF6B85] font-semibold" : "text-white font-semibold"}>{m.usage_count}</span> / {m.usage_limit}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={submitForm} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[13px] font-semibold mb-3">{editingId ? "Rekvizitni tahrirlash" : "Yangi rekvizit"}</div>
          <div className="mb-3">
            <label className="block text-[12px] text-muted mb-1.5">Turi</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px]"
              value={form.method_type}
              onChange={(e) => setForm((prev) => ({ ...prev, method_type: e.target.value as OperatorPaymentMethod["method_type"] }))}
            >
              {(Object.keys(METHOD_TYPE_LABELS) as OperatorPaymentMethod["method_type"][]).map((k) => (
                <option key={k} value={k}>{METHOD_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-[12px] text-muted mb-1.5">Raqam / manzil</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
              value={form.account_number}
              onChange={(e) => setForm((prev) => ({ ...prev, account_number: e.target.value }))}
              placeholder={form.method_type === "crypto" ? "T..." : "+998 90 123 45 67"}
            />
          </div>
          {form.method_type !== "crypto" && (
            <div className="mb-4">
              <label className="block text-[12px] text-muted mb-1.5">Egasining F.I.Sh.</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
                value={form.holder_name}
                onChange={(e) => setForm((prev) => ({ ...prev, holder_name: e.target.value }))}
                placeholder="Masalan: Aliyev Vali"
              />
            </div>
          )}
          <div className="mb-4">
            <label className="block text-[12px] text-muted mb-1.5">Ishlatilish limiti (ixtiyoriy)</label>
            <input
              type="number"
              min={1}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
              value={form.usage_limit}
              onChange={(e) => setForm((prev) => ({ ...prev, usage_limit: e.target.value }))}
              placeholder="Masalan: 20 — shuncha marta ishlatilgach o'chiriladi"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px]">
              Bekor qilish
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : editingId ? "Saqlash" : "Qo'shish"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]"
        >
          <CreditCard size={15} /> Yangi rekvizit qo'shish
        </button>
      )}
    </div>
  );
}

