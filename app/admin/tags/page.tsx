"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Tag = { id: string; name: string; slug: string };

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("tags").select("*").order("name");
    setTags((data as Tag[]) ?? []);
    // One query total instead of one per tag (was N+1).
    const { data: rows } = await supabase.from("post_tags").select("tag_id");
    const counts: Record<string, number> = {};
    for (const row of rows ?? []) {
      counts[row.tag_id] = (counts[row.tag_id] ?? 0) + 1;
    }
    setUsageCounts(counts);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Nom kiriting."); return; }
    const payload = { name: name.trim(), slug: slugify(name) };
    const result = editingId
      ? await supabase.from("tags").update(payload).eq("id", editingId)
      : await supabase.from("tags").insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setName(""); setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Teg o'chirilsinmi?")) return;
    await supabase.from("tags").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[22px] font-bold mb-1">Teglar</h1>
      <p className="text-[13px] text-muted mb-6">Blog postlarini belgilash uchun umumiy teglar.</p>

      <form onSubmit={save} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6 flex gap-2">
        <input className={inputCls} placeholder="Teg nomi" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold shrink-0">
          <Plus size={14} /> {editingId ? "Saqlash" : "Qo'shish"}
        </button>
      </form>
      {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-full border border-white/10 pl-3 pr-1.5 py-1 text-[12px]">
            <span>{t.name}</span>
            <span className="text-[10px] text-[#5b6f85]">{usageCounts[t.id] ?? 0}</span>
            <button onClick={() => { setName(t.name); setEditingId(t.id); }} className="p-1 rounded-full hover:bg-white/10"><Pencil size={11} /></button>
            <button onClick={() => remove(t.id)} className="p-1 rounded-full hover:bg-white/10 text-[#FF6B85]"><Trash2 size={11} /></button>
          </div>
        ))}
        {tags.length === 0 && <p className="text-[12px] text-[#5b6f85]">Hozircha teg yo'q.</p>}
      </div>
    </div>
  );
}
