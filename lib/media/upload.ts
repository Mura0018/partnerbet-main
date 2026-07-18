"use client";

import { createClient } from "@/lib/supabase";

export type UploadedMedia = {
  id: string;
  publicUrl: string;
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB, matches the "media" bucket limit (Phase 1)
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Uploads an image to the "media" Storage bucket and records it in the
// `media` table, returning the row id (for FK references, e.g.
// site_settings.branding.logo_media_id) and its public URL. This is a
// focused, fully-functional upload used by Site Settings (logo/favicon)
// and Affiliate partner logos — the full drag-and-drop Media Library
// browser/gallery UI is Phase 4 scope.
export async function uploadImage(file: File): Promise<UploadedMedia> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Faqat PNG, JPEG, WEBP yoki SVG fayllar qabul qilinadi.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Fayl hajmi 20MB dan oshmasligi kerak.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tizimga kirilmagan.");

  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("media").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);

  const { data: mediaRow, error: insertError } = await supabase
    .from("media")
    .insert({
      file_name: file.name,
      storage_path: path,
      public_url: publicUrlData.publicUrl,
      mime_type: file.type,
      file_size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select("id, public_url")
    .single();

  if (insertError || !mediaRow) throw new Error(insertError?.message ?? "Media yozuvini saqlab bo'lmadi.");

  return { id: mediaRow.id, publicUrl: mediaRow.public_url };
}
