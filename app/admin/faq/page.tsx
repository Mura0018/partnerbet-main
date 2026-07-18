"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Faq = { id: string; question: string; answer: string; category: string | null; position: number; is_active: boolean };
const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

export default function FaqAdminPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [form, setForm] = useState({ question: "", answer: "", category: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("faqs").select("*").is("deleted_at", null).order("position");
    setFaqs((data as Faq[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.question.trim() || !form.answer.trim()) { setError("Savol va javob kiritilishi shart."); return; }
    const payload = { question: form.question.trim(), answer: form.answer.trim(), category: form.category.trim() || null };
    const result = editingId
      ? await supabase.from("faqs").update(payload).eq("id", editingId)
      : await supabase.from("faqs").insert({ ...payload, position: faqs.length });
    if (result.error) { setError(result.error.message); return; }
    setForm({ question: "", answer: "", category: "" });
    setEditingId(null);
    load();
  };

  const openEdit = (f: Faq) => {
    setForm({ question: f.question, answer: f.answer, category: f.category ?? "" });
    setEditingId(f.id);
  };

  const toggleActive = async (f: Faq) => {
    await supabase.from("faqs").update({ is_active: !f.is_active }).eq("id", f.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Savol o'chirilsinmi?")) return;
    await supabase.from("faqs").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = faqs[index + direction];
    if (!target) return;
    const current = faqs[index];
    await Promise.all([
      supabase.from("faqs").update({ position: target.position }).eq("id", current.id),
      supabase.from("faqs").update({ position: current.position }).eq("id", target.id),
    ]);
    load();
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[22px] font-bold mb-1">FAQ</h1>
      <p className="text-[13px] text-muted mb-6">Ochiq "/faq" sahifasida ko'rinadigan savol-javoblar.</p>

      <form onSubmit={save} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6 space-y-2">
        <input className={inputCls} placeholder="Savol" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <textarea rows={3} className={inputCls} placeholder="Javob" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <input className={inputCls} placeholder="Kategoriya (ixtiyoriy)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold">
            <Plus size={14} /> {editingId ? "Saqlash" : "Qo'shish"}
          </button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ question: "", answer: "", category: "" }); }} className="px-4 py-2 rounded-lg border border-white/10 text-[12px]">Bekor qilish</button>}
        </div>
      </form>

      <div className="space-y-2">
        {faqs.map((f, i) => (
          <div key={f.id} className="rounded-lg border border-white/8 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-[13px]">{f.question}</div>
                <p className="text-[12px] text-muted mt-1 line-clamp-2">{f.answer}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><GripVertical size={13} className="rotate-90" /></button>
                <button onClick={() => toggleActive(f)} className={`text-[10px] px-2 py-1 rounded-full border ${f.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-muted border-white/10"}`}>{f.is_active ? "Faol" : "Faolsiz"}</button>
                <button onClick={() => openEdit(f)} className="p-1 rounded hover:bg-white/10"><Pencil size={13} /></button>
                <button onClick={() => remove(f.id)} className="p-1 rounded hover:bg-white/10 text-[#FF6B85]"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        {faqs.length === 0 && <p className="text-[12px] text-muted text-center py-6">Hozircha savol yo'q.</p>}
      </div>
    </div>
  );
}
