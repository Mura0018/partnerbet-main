import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

const ALLOWED_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_SECONDS = 180;

function extFor(mimeType: string): string | null {
  const base = mimeType.split(";")[0].trim();
  return ALLOWED_MIME[base] ?? null;
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-support-voice:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, audioBase64, mimeType, durationSeconds } = body ?? {};
  if (!initData || !audioBase64 || !mimeType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const ext = extFor(mimeType);
  if (!ext) return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
  const duration = Number(durationSeconds) || 0;
  if (duration <= 0 || duration > MAX_DURATION_SECONDS) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }

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
    buffer = Buffer.from(audioBase64, "base64");
  } catch {
    return NextResponse.json({ error: "invalid_audio" }, { status: 400 });
  }
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_audio_size" }, { status: 400 });
  }

  const path = `${customer.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("support-attachments").upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data: inserted, error } = await supabase
    .from("telegram_support_messages")
    .insert({ customer_id: customer.id, sender: "customer", voice_path: path, voice_duration_seconds: duration })
    .select("id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  await supabase.from("telegram_support_threads").upsert(
    { customer_id: customer.id, is_archived: false, updated_at: new Date().toISOString() },
    { onConflict: "customer_id" }
  );

  return NextResponse.json({ message: inserted });
}
