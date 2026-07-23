"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Landmark, Plus, Loader2, Pencil, Trash2, X, RefreshCw, DownloadCloud, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/ui/toast";

type Operator = { id: string; full_name: string | null; email: string | null };
type Cashdesk = {
  id: string;
  name: string;
  cashdesk_id: string;
  login: string;
  owner_operator_id: string | null;
  is_active: boolean;
  region: string | null;
  low_balance_threshold: number | null;
  note: string | null;
  created_at: string;
};
type BalState = { loading: boolean; ok?: boolean; balance?: number | null; low?: boolean; error?: string };

const fmtSum = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("ru-RU"));

type FormState = {
  id?: string;
  name: string;
  cashdesk_id: string;
  login: string;
  pass: string;
  hash: string;
  owner_operator_id: string;
  region: string;
  low_balance_threshold: string;
  note: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "", cashdesk_id: "", login: "", pass: "", hash: "",
  owner_operator_id: "", region: "", low_balance_threshold: "", note: "", is_active: true,
};

export default function CashdesksManager() {
  const [rows, setRows] = useState<Cashdesk[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<Record<string, BalState>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const ownerName = (id: string | null) => {
    if (!id) return "—";
    const o = operators.find((x) => x.id === id);
    return o?.full_name || o?.email || "—";
  };

  const loadBalance = useCallback(async (id: string) => {
    setBalances((b) => ({ ...b, [id]: { loading: true } }));
    try {
      const res = await fetch(`/api/admin/cashdesks/${id}/balance`);
      const data = await res.json();
      if (!res.ok) { setBalances((b) => ({ ...b, [id]: { loading: false, ok: false, error: "forbidden" } })); return; }
      if (!data.ok) { setBalances((b) => ({ ...b, [id]: { loading: false, ok: false, error: data.error } })); return; }
      setBalances((b) => ({ ...b, [id]: { loading: false, ok: true, balance: data.balance, low: data.low } }));
    } catch {
      setBalances((b) => ({ ...b, [id]: { loading: false, ok: false, error: "network" } }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cashdesks");
      const data = await res.json();
      if (!res.ok) { toast.error("Yuklashda xatolik: " + (data.error ?? "")); return; }
      setRows(data.cashdesks ?? []);
      setOperators(data.operators ?? []);
      // Balanslarni non-blocking, har kassa alohida.
      for (const c of data.cashdesks ?? []) loadBalance(c.id);
    } catch {
      toast.error("Ulanishda xatolik.");
    } finally {
      setLoading(false);
    }
  }, [loadBalance]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setForm({ ...emptyForm });
  const openEdit = (c: Cashdesk) =>
    setForm({
      id: c.id, name: c.name, cashdesk_id: c.cashdesk_id, login: c.login,
      pass: "", hash: "", owner_operator_id: c.owner_operator_id ?? "",
      region: c.region ?? "", low_balance_threshold: c.low_balance_threshold != null ? String(c.low_balance_threshold) : "",
      note: c.note ?? "", is_active: c.is_active,
    });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.cashdesk_id.trim() || !form.login.trim()) {
      toast.error("Nom, KRM raqami va login shart."); return;
    }
    if (!form.id && (!form.pass.trim() || !form.hash.trim())) {
      toast.error("Yangi kassa uchun pass va hash shart."); return;
    }
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/admin/cashdesks/${form.id}` : "/api/admin/cashdesks";
      const payload: any = {
        name: form.name, cashdesk_id: form.cashdesk_id, login: form.login,
        owner_operator_id: form.owner_operator_id || null,
        region: form.region, note: form.note, is_active: form.is_active,
        low_balance_threshold: form.low_balance_threshold === "" ? null : form.low_balance_threshold,
      };
      // Maxfiy kalit faqat kiritilgan bo'lsa yuboriladi.
      if (form.pass.trim()) payload.pass = form.pass;
      if (form.hash.trim()) payload.hash = form.hash;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error === "duplicate_cashdesk_id" ? "Bu KRM raqami allaqachon mavjud." : (data.error ?? "xatolik");
        toast.error("Saqlanmadi: " + msg); return;
      }
      toast.success(isEdit ? "Kassa yangilandi." : "Kassa qo'shildi.");
      setForm(null);
      await load();
    } catch {
      toast.error("Ulanishda xatolik.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Cashdesk) => {
    if (!confirm(`"${c.name}" kassasi o'chirilsinmi?`)) return;
    try {
      const res = await fetch(`/api/admin/cashdesks/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error("O'chirilmadi: " + (data.error ?? "")); return; }
      toast.success("Kassa o'chirildi.");
      await load();
    } catch {
      toast.error("Ulanishda xatolik.");
    }
  };

  const importLegacy = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/admin/cashdesks/import-legacy", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.error === "no_legacy" ? "Ko'chiriladigan eski kassa topilmadi." : (data.error ?? "xatolik");
        toast.error(msg); return;
      }
      if (data.alreadyExists) toast.info("Kassa allaqachon ko'chirilgan.");
      else toast.success("Mavjud kassa muvaffaqiyatli ko'chirildi.");
      await load();
    } catch {
      toast.error("Ulanishda xatolik.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><Landmark size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold text-white">Kassalar</h1>
            <p className="text-xs text-white/40">Ko'p kassa (multi-cashdesk) — poydevor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && rows.length === 0 && (
            <button onClick={importLegacy} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-50">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />} Mavjud kassani ko'chirish
            </button>
          )}
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#1CE0C3] text-[#04231F] hover:brightness-110">
            <Plus size={16} /> Yangi kassa
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-white/40 text-sm border border-white/10 rounded-2xl">
          Hozircha kassa yo'q. "Yangi kassa" qo'shing yoki mavjud kassani ko'chiring.
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs border-b border-white/10">
              <tr>
                <th className="text-left font-medium px-4 py-3">Nom</th>
                <th className="text-left font-medium px-4 py-3">KRM</th>
                <th className="text-left font-medium px-4 py-3">Egasi</th>
                <th className="text-left font-medium px-4 py-3">Mintaqa</th>
                <th className="text-right font-medium px-4 py-3">Balans</th>
                <th className="text-right font-medium px-4 py-3">Chegara</th>
                <th className="text-center font-medium px-4 py-3">Holat</th>
                <th className="text-right font-medium px-4 py-3">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const b = balances[c.id];
                return (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-white/60">{c.cashdesk_id}</td>
                    <td className="px-4 py-3 text-white/60">{ownerName(c.owner_operator_id)}</td>
                    <td className="px-4 py-3 text-white/60">{c.region || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {!b || b.loading ? (
                        <Loader2 size={14} className="animate-spin inline text-white/30" />
                      ) : !b.ok ? (
                        <span className="text-white/30 text-xs">balans olinmadi</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-medium ${b.low ? "text-[#FF6B85]" : "text-[#4ADE80]"}`}>
                          {b.low && <AlertTriangle size={13} />}{fmtSum(b.balance)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white/50">{fmtSum(c.low_balance_threshold)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "bg-white/5 text-white/40"}`}>
                        {c.is_active ? "Aktiv" : "O'chiq"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => loadBalance(c.id)} title="Balansni yangilash"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><RefreshCw size={15} /></button>
                        <button onClick={() => openEdit(c)} title="Tahrirlash"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60"><Pencil size={15} /></button>
                        <button onClick={() => remove(c)} title="O'chirish"
                          className="p-1.5 rounded-lg hover:bg-[#FF6B85]/10 text-[#FF6B85]"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && setForm(null)}>
          <div className="bg-[#0E1518] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#0E1518]">
              <h2 className="text-white font-semibold">{form.id ? "Kassani tahrirlash" : "Yangi kassa"}</h2>
              <button onClick={() => !saving && setForm(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/50"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Kassa nomi *"><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Toshkent-1" /></Field>
              <Field label="1xBet KRM raqami (cashdesk_id) *"><input className={inp} value={form.cashdesk_id} onChange={(e) => setForm({ ...form, cashdesk_id: e.target.value })} placeholder="123456" /></Field>
              <Field label="Login *"><input className={inp} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoComplete="off" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={form.id ? "Parol (yangilash uchun)" : "Parol (cashierpass) *"}>
                  <input className={inp} type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} placeholder={form.id ? "o'zgarmasa bo'sh" : ""} autoComplete="new-password" />
                </Field>
                <Field label={form.id ? "Hash (yangilash uchun)" : "Hash *"}>
                  <input className={inp} type="password" value={form.hash} onChange={(e) => setForm({ ...form, hash: e.target.value })} placeholder={form.id ? "o'zgarmasa bo'sh" : ""} autoComplete="new-password" />
                </Field>
              </div>
              <p className="text-[11px] text-white/30 -mt-1">🔒 Parol va hash bazaga shifrlangan saqlanadi, hech qachon ko'rsatilmaydi.</p>
              <Field label="Kassa egasi (operator)">
                <select className={inp} value={form.owner_operator_id} onChange={(e) => setForm({ ...form, owner_operator_id: e.target.value })}>
                  <option value="">— tanlanmagan —</option>
                  {operators.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mintaqa"><input className={inp} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="ixtiyoriy" /></Field>
                <Field label="Past balans chegarasi"><input className={inp} type="number" value={form.low_balance_threshold} onChange={(e) => setForm({ ...form, low_balance_threshold: e.target.value })} placeholder="ixtiyoriy" /></Field>
              </div>
              <Field label="Izoh"><input className={inp} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ixtiyoriy" /></Field>
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[#1CE0C3]" />
                Aktiv (buyurtmalarda ishlatiladi)
              </label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
              <button onClick={() => setForm(null)} disabled={saving} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:bg-white/5">Bekor</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#1CE0C3] text-[#04231F] hover:brightness-110 disabled:opacity-50">
                {saving && <Loader2 size={15} className="animate-spin" />} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-[#1CE0C3]/50 placeholder:text-white/25";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-white/40 mb-1">{label}</span>
      {children}
    </label>
  );
}
