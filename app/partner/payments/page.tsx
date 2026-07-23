"use client";

import React, { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";

const KINDS: { key: string; label: string }[] = [
  { key: "click", label: "Click" },
  { key: "payme", label: "Payme" },
  { key: "card", label: "Karta" },
  { key: "crypto", label: "USDT (TRC20)" },
];
const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? k;

export default function PartnerPaymentsPage() {
  const supabase = createClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ kind: "click", number: "", holder: "" });
  const [saving, setSaving] = useState(false);

  const loadMethods = async (pid: string) => {
    const { data, error } = await supabase.from("partner_payment_methods").select("id, kind, number, holder, is_active").eq("partner_id", pid).order("created_at");
    if (error) { setMissing(true); return; }
    setMissing(false);
    setMethods((data as any[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: mem } = await supabase.from("partner_members").select("partner_id, partner_role").eq("profile_id", user.id).maybeSingle();
      const pid = (mem as any)?.partner_id ?? null;
      setPartnerId(pid);
      setRole((mem as any)?.partner_role ?? "");
      if (pid) await loadMethods(pid);
      setLoading(false);
    })();
  }, []);

  const isAdmin = role === "partner_admin";

  const add = async () => {
    if (!form.number.trim()) { toast.error("Raqam/hisobni kiriting."); return; }
    if (!partnerId) return;
    setSaving(true);
    const { error } = await supabase.from("partner_payment_methods").insert({ partner_id: partnerId, kind: form.kind, number: form.number.trim(), holder: form.holder.trim() || null });
    setSaving(false);
    if (error) { toast.error("Qo'shilmadi: " + error.message); return; }
    toast.success("To'lov usuli qo'shildi ✅");
    setForm({ kind: "click", number: "", holder: "" });
    setShowAdd(false);
    loadMethods(partnerId);
  };

  const remove = async (id: string) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    const { error } = await supabase.from("partner_payment_methods").delete().eq("id", id);
    if (error) toast.error("O'chirilmadi: " + error.message);
    else { toast.success("O'chirildi"); if (partnerId) loadMethods(partnerId); }
  };

  if (loading) return <div className="p-6 text-[13px] text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2"><CreditCard size={20} className="text-accent" /><h1 className="text-[22px] font-bold">To'lov usullari</h1></div>
        {isAdmin && !missing && <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]"><Plus size={14} /> Qo'shish</button>}
      </div>
      <p className="text-[13px] text-muted mb-6">Mijozlaringiz shu raqamlarga to'laydi.</p>

      {missing ? (
        <div className="rounded-xl border border-[#F4C76A]/30 bg-[#F4C76A]/10 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#F4C76A] shrink-0 mt-0.5" />
          <div className="text-[13px]"><div className="font-semibold text-[#F4C76A] mb-1">Jadval topilmadi</div><div className="text-muted">0062 migratsiyasini Supabase'da ishga tushiring.</div></div>
        </div>
      ) : (
        <>
          {showAdd && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4 space-y-2.5">
              <select value={form.kind} onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent">
                {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
              <input value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} placeholder="Raqam / hisob" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
              <input value={form.holder} onChange={(e) => setForm((p) => ({ ...p, holder: e.target.value }))} placeholder="Egasi (ixtiyoriy)" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
              <button onClick={add} disabled={saving} className="w-full py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Saqlash"}</button>
            </div>
          )}

          {methods.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">Hozircha to'lov usuli yo'q.</div>
          ) : (
            <div className="space-y-2">
              {methods.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{kindLabel(m.kind)}</div>
                    <div className="text-[12px] text-muted">{m.number}{m.holder ? ` · ${m.holder}` : ""}</div>
                  </div>
                  {isAdmin && <button onClick={() => remove(m.id)} className="p-1.5 rounded hover:bg-[#FF6B85]/10 text-[#FF6B85]" aria-label="O'chirish"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
