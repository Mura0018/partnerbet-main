import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-support-image:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, imageBase64, mimeType, fileName, caption } = body ?? {};
  if (!initData || !imageBase64 || !mimeType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) return NextResponse.json({ error: "invalid_mime" }, { status: 400 });

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageBase64, "base64");
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_image_size" }, { status: 400 });
  }

  const path = `${customer.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("support-attachments").upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  // F2: ixtiyoriy caption `message` maydonига yoziladi (chk_message_or_image
  // image_path bo'lganда message + image birga bo'lishига ruxsat beradi).
  const captionText = typeof caption === "string" ? caption.trim().slice(0, 2000) : "";
  const { data: inserted, error } = await supabase
    .from("telegram_support_messages")
    .insert({ customer_id: customer.id, sender: "customer", image_path: path, file_name: fileName ? String(fileName).slice(0, 200) : null, message: captionText || null })
    .select("id, sender, message, image_path, file_name, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  await supabase.from("telegram_support_threads").upsert(
    { customer_id: customer.id, is_archived: false, updated_at: new Date().toISOString() },
    { onConflict: "customer_id" }
  );
  return NextResponse.json({ message: inserted });
}
