"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Copy, Check, Search, Loader2, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/media/upload";

type MediaItem = {
  id: string;
  file_name: string;
  public_url: string;
  mime_type: string;
  file_size_bytes: number | null;
  created_at: string;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase
      .from("media")
      .select("id, file_name, public_url, mime_type, file_size_bytes, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as MediaItem[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setError("");
    setUploading(true);
    setUploadProgress({ done: 0, total: fileArray.length });

    for (const file of fileArray) {
      try {
        await uploadImage(file);
      } catch (e: any) {
        setError((prev) => (prev ? `${prev}; ` : "") + `${file.name}: ${e.message ?? "xatolik"}`);
      }
      setUploadProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setUploading(false);
    load();
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, []);

  const copyUrl = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.public_url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard permissions can fail silently; URL remains visible on click-through.
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Fayl o'chirilsinmi? (Agar biror joyda ishlatilgan bo'lsa, o'sha rasm ko'rinmay qoladi)")) return;
    await supabase.from("media").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const filtered = items.filter((i) => i.file_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-[22px] font-bold mb-1">Media Library</h1>
      <p className="text-[13px] text-muted mb-6">Barcha yuklangan rasm va fayllar — logotip, muqova, banner va h.k. uchun.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-8 text-center mb-6 cursor-pointer transition ${
          dragOver ? "border-accent bg-accent/5" : "border-white/15 hover:border-white/25"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="animate-spin text-accent" />
            <span className="text-[13px] text-muted">Yuklanmoqda… {uploadProgress.done}/{uploadProgress.total}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={22} className="text-[#5b6f85]" />
            <span className="text-[13px] text-muted">Fayllarni shu yerga tashlang yoki bosing (bir nechtasi bir vaqtda)</span>
          </div>
        )}
        <input
          ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-[12px] text-[#FF6B85] mb-4">{error}</p>}

      <div className="relative mb-5 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Fayl nomi bo'yicha qidirish…"
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center text-[13px] text-[#5b6f85]">
          <ImageIcon size={22} className="mx-auto mb-2 text-[#3d4d5f]" />
          Hech narsa topilmadi.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="group relative rounded-lg border border-white/8 bg-white/[0.02] overflow-hidden">
              <img src={item.public_url} alt={item.file_name} className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-2">
                <div className="text-[10px] text-white truncate">{item.file_name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[#a8c1d9]">{formatBytes(item.file_size_bytes)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => copyUrl(item)} className="p-1 rounded bg-white/10 hover:bg-white/20" aria-label="URL nusxalash">
                      {copiedId === item.id ? <Check size={11} className="text-[#4ADE80]" /> : <Copy size={11} className="text-white" />}
                    </button>
                    <button onClick={() => remove(item.id)} className="p-1 rounded bg-white/10 hover:bg-[#FF3B5C]/30" aria-label="O'chirish">
                      <Trash2 size={11} className="text-[#FF6B85]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
