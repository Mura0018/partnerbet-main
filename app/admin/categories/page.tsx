"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
  slug: string;
  content_type: "post" | "football_news";
  parent_id: string | null;
  description: string | null;
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function CategoriesPage() {
  const [contentType, setContentType] = useState<"post" | "football_news">("post");
  const [categories, setCategories] = useState<Category[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", slug: "", parent_id: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("content_type", contentType)
      .is("deleted_at", null)
      .order("name");
    setCategories((data as Category[]) ?? []);

    // Post counts per category — one query total instead of one per
    // category (was N+1: a separate COUNT query per row).
    const table = contentType === "post" ? "posts" : "football_news";
    const { data: rows } = await supabase.from(table).select("category_id").is("deleted_at", null).not("category_id", "is", null);
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) {
      counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
    }
    setPostCounts(counts);
  };
  useEffect(() => { load(); }, [contentType]);

  const openNew = () => { setForm({ name: "", slug: "", parent_id: "", description: "" }); setEditingId(null); };
  const openEdit = (c: Category) => {
    setForm({ name: c.name, slug: c.slug, parent_id: c.parent_id ?? "", description: c.description ?? "" });
    setEditingId(c.id);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Nom kiriting."); return; }
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      content_type: contentType,
      parent_id: form.parent_id || null,
      description: form.description.trim() || null,
    };
    const result = editingId
      ? await supabase.from("categories").update(payload).eq("id", editingId)
      : await supabase.from("categories").insert(payload);
    if (result.error) { setError(result.error.message); return; }
    openNew();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Kategoriya o'chirilsinmi? (Unga bog'langan postlar kategoriyasiz qoladi)")) return;
    await supabase.from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-[22px] font-bold mb-1">Kategoriyalar</h1>
      <p className="text-[13px] text-muted mb-6">Blog va Football News uchun kategoriyalarni boshqaring.</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setContentType("post")} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${contentType === "post" ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"}`}>Blog</button>
        <button onClick={() => setContentType("football_news")} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${contentType === "football_news" ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"}`}>Football News</button>
      </div>

      <form onSubmit={save} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="Slug (avtomatik)" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
        </div>
        <select className={inputCls} value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
          <option value="">— Ota kategoriyasiz —</option>
          {categories.filter((c) => c.id !== editingId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <textarea rows={2} className={inputCls} placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold">
            <Plus size={14} /> {editingId ? "Saqlash" : "Qo'shish"}
          </button>
          {editingId && <button type="button" onClick={openNew} className="px-4 py-2 rounded-lg border border-white/10 text-[12px]">Bekor qilish</button>}
        </div>
      </form>

      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/8 p-3">
            <div>
              <div className="text-[13px] font-medium">{c.name} <span className="text-[11px] text-[#5b6f85] font-normal">/{c.slug} · {postCounts[c.id] ?? 0} ta post</span></div>
              {c.parent_id && <div className="text-[11px] text-[#5b6f85]">↳ {categories.find((p) => p.id === c.parent_id)?.name}</div>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-white/10"><Pencil size={13} /></button>
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-[12px] text-[#5b6f85] text-center py-6">Hozircha kategoriya yo'q.</p>}
      </div>
    </div>
  );
}
