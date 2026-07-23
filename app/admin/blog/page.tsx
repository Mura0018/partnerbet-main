"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, X, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/media/upload";
import { RichTextEditor } from "@/lib/editor/RichTextEditor";
import { usePermission } from "@/lib/auth/permissions";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_media_id: string | null;
  cover_url?: string | null;
  category_id: string | null;
  language: string;
  status: "draft" | "scheduled" | "published" | "archived";
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  scheduled_at: string | null;
};

type Category = { id: string; name: string };
type Tag = { id: string; name: string };

const STATUSES: Post["status"][] = ["draft", "scheduled", "published", "archived"];
const STATUS_LABEL: Record<Post["status"], { label: string; className: string }> = {
  draft: { label: "Qoralama", className: "bg-white/5 text-[#5b6f85] border-white/10" },
  scheduled: { label: "Rejalashtirilgan", className: "bg-vip/10 text-vip border-vip/30" },
  published: { label: "Nashr etilgan", className: "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" },
  archived: { label: "Arxivlangan", className: "bg-white/5 text-[#5b6f85] border-white/10" },
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const EMPTY: any = {
  title: "", slug: "", excerpt: "", content: "", cover_media_id: null, cover_url: null,
  category_id: "", language: "en", status: "draft", seo_title: "", seo_description: "",
  seo_keywords: "", scheduled_at: "",
};

export default function BlogManager() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [postTagIds, setPostTagIds] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState<any>(EMPTY);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManageTaxonomy = usePermission("taxonomy.manage");
  const supabase = createClient();

  const load = async () => {
    const [{ data: postsData }, { data: categoriesData }, { data: tagsData }, { data: postTagsData }] = await Promise.all([
      supabase.from("posts").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name").eq("content_type", "post").is("deleted_at", null).order("name"),
      supabase.from("tags").select("id, name").order("name"),
      supabase.from("post_tags").select("post_id, tag_id"),
    ]);
    setPosts((postsData as Post[]) ?? []);
    setCategories((categoriesData as Category[]) ?? []);
    setAllTags((tagsData as Tag[]) ?? []);
    const map: Record<string, string[]> = {};
    for (const row of postTagsData ?? []) {
      map[row.post_id] = [...(map[row.post_id] ?? []), row.tag_id];
    }
    setPostTagIds(map);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setSelectedTagIds([]); setEditingId(null); setShowForm(true); setError(""); };
  const openEdit = (p: Post) => {
    setForm({
      ...p,
      category_id: p.category_id ?? "",
      seo_keywords: (p.seo_keywords ?? []).join(", "),
      scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : "",
    });
    setSelectedTagIds(postTagIds[p.id] ?? []);
    setEditingId(p.id);
    setShowForm(true);
    setError("");
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const media = await uploadImage(file);
      setForm((prev: any) => ({ ...prev, cover_media_id: media.id, cover_url: media.publicUrl }));
    } catch (e: any) {
      setError(e.message ?? "Yuklashda xatolik.");
    } finally {
      setCoverUploading(false);
    }
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const quickAddTag = async (name: string) => {
    if (!name.trim()) return;
    const { data } = await supabase.from("tags").insert({ name: name.trim(), slug: slugify(name) }).select("id, name").single();
    if (data) {
      setAllTags((prev) => [...prev, data as Tag]);
      setSelectedTagIds((prev) => [...prev, (data as Tag).id]);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.content.trim()) { setError("Sarlavha va matn kiritilishi shart."); return; }
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      cover_media_id: form.cover_media_id,
      cover_url: form.cover_url ?? null,
      category_id: form.category_id || null,
      language: form.language,
      status: form.status,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords: form.seo_keywords ? form.seo_keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : null,
      scheduled_at: form.status === "scheduled" && form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      published_at: form.status === "published" ? new Date().toISOString() : null,
    };

    let postId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase.from("posts").update(payload).eq("id", editingId);
      if (updateError) { setError(updateError.message); setSaving(false); return; }
    } else {
      const { data, error: insertError } = await supabase.from("posts").insert(payload).select("id").single();
      if (insertError || !data) { setError(insertError?.message ?? "Saqlashda xatolik."); setSaving(false); return; }
      postId = data.id;
    }

    // Sync post_tags: remove all, re-insert selected (simple + correct for a small tag list per post).
    if (postId) {
      await supabase.from("post_tags").delete().eq("post_id", postId);
      if (selectedTagIds.length > 0) {
        await supabase.from("post_tags").insert(selectedTagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));
      }
    }

    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Post o'chirilsinmi?")) return;
    await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold">Blog</h1>
          <p className="text-[13px] text-muted mt-1">
            SEO maqolalar. <Link href="/admin/categories" className="text-accent hover:underline">Kategoriyalar</Link> ·{" "}
            <Link href="/admin/tags" className="text-accent hover:underline">Teglar</Link>
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Yangi maqola
        </button>
      </div>

      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 min-w-0">
              {p.cover_url && <img src={p.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />}
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12px] mb-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">{categoryName(p.category_id)}</span>
                  <span className={`px-2 py-0.5 rounded-full border ${STATUS_LABEL[p.status].className}`}>{STATUS_LABEL[p.status].label}</span>
                  {(postTagIds[p.id] ?? []).length > 0 && <span className="text-[#5b6f85]">{(postTagIds[p.id] ?? []).length} teg</span>}
                </div>
                <div className="font-semibold text-[14px] truncate">{p.title}</div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="p-2 rounded-md hover:bg-white/10" aria-label="Tahrirlash"><Pencil size={14} /></button>
              <button onClick={() => remove(p.id)} className="p-2 rounded-md hover:bg-white/10 text-[#FF6B85]" aria-label="O'chirish"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-[#5b6f85]">Hozircha maqola yo'q.</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
          <form onSubmit={save} className="w-full max-w-2xl rounded-2xl border border-white/10 bg-panel max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px]">{editingId ? "Tahrirlash" : "Yangi maqola"}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Yopish"><X size={18} /></button>
            </div>

            <label className="block text-[12px] text-muted mb-1">Sarlavha</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${inputCls} mb-3`} />

            <label className="block text-[12px] text-muted mb-1">Qisqacha tavsif (excerpt)</label>
            <textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={`${inputCls} mb-3`} />

            <label className="block text-[12px] text-muted mb-1">Muqova rasmi</label>
            <div className="flex items-center gap-3 mb-3">
              {form.cover_url && <img src={form.cover_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-white/10" />}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-[12px] cursor-pointer hover:bg-white/5">
                {coverUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Yuklash
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={coverUploading}
                  onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[12px] text-muted mb-1">Kategoriya</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={inputCls}>
                  <option value="">— tanlanmagan —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-muted mb-1">Til</label>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={inputCls}>
                  <option value="en">English</option><option value="ru">Русский</option><option value="uz">O'zbek</option>
                </select>
              </div>
            </div>

            <label className="block text-[12px] text-muted mb-1.5">Teglar</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {allTags.map((t) => (
                <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${selectedTagIds.includes(t.id) ? "bg-accent/10 text-accent border-accent/30" : "border-white/10 text-muted"}`}>
                  {t.name}
                </button>
              ))}
              {canManageTaxonomy && (
                <button type="button" onClick={() => { const n = window.prompt("Yangi teg nomi:"); if (n) quickAddTag(n); }}
                  className="px-2.5 py-1 rounded-full text-[11px] border border-dashed border-white/20 text-[#5b6f85]">
                  + Yangi teg
                </button>
              )}
            </div>

            <label className="block text-[12px] text-muted mb-1">Matn</label>
            <div className="mb-3">
              <RichTextEditor value={form.content} onChange={(html) => setForm({ ...form, content: html })} />
            </div>

            <details className="mb-3">
              <summary className="text-[12px] text-muted cursor-pointer mb-2">SEO sozlamalari (ixtiyoriy)</summary>
              <input placeholder="SEO sarlavha" value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className={`${inputCls} mb-2`} />
              <textarea rows={2} placeholder="SEO tavsif" value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} className={`${inputCls} mb-2`} />
              <input placeholder="Kalit so'zlar (vergul bilan)" value={form.seo_keywords} onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })} className={inputCls} />
            </details>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[12px] text-muted mb-1">Holat</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s].label}</option>)}
                </select>
              </div>
              {form.status === "scheduled" && (
                <div>
                  <label className="block text-[12px] text-muted mb-1">Rejalashtirilgan vaqt</label>
                  <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className={inputCls} />
                </div>
              )}
            </div>

            {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-60">
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
