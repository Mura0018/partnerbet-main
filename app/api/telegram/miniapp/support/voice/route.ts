import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { notifyOperatorsSupportMessage } from "@/lib/telegram/notifyStaff";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

const ALLOWED_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};
// 1.5: 3 MB — 180 s Opus ~1 MB; avval 8 MB edi, lekin bucket chegarasi 5 MB
// (0041) va so'rov tanasi chegarasi sababli katta fayllar baribir yiqilardi.
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_DURATION_SECONDS = 180;

function extFor(mimeType: string): string | null {
  const base = mimeType.split(";")[0].trim();
  return ALLOWED_MIME[base] ?? null;
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  // 1.4: IP chegarasi keng (NAT), asosiysi mijoz bo'yicha — pastda.
  const { allowed } = await checkAndRecordRateLimit(`telegram-support-voice:${ip}`, 60, 60);
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

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const { allowed: custAllowed } = await checkAndRecordRateLimit(`telegram-support-voice-c:${customer.id}`, 60, 10);
  if (!custAllowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Dekod qilishdan OLDIN base64 uzunligi tekshiriladi (katta tanani bekor
  // xotiraga olmaslik uchun). Buffer.from base64'da xato tashlamaydi.
  if (typeof audioBase64 !== "string" || audioBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) {
    return NextResponse.json({ error: "invalid_audio_size" }, { status: 400 });
  }
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
    // Bucket allowed_mime_types asosiy turni biladi ("audio/webm"), kodek
    // parametri (";codecs=opus") olib tashlanadi.
    contentType: mimeType.split(";")[0].trim(),
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data: inserted, error } = await supabase
    .from("telegram_support_messages")
    .insert({ customer_id: customer.id, sender: "customer", voice_path: path, voice_duration_seconds: duration })
    .select("id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  // last_customer_message_at + status='open' — matn xabari bilan bir xil
  // (avval faqat matn yangilardi: media-only mijoz "javobsiz" ko'rinmasdi,
  // yakunlangan suhbatga media yuborilsa status 'ended' qolardi).
  const threadNow = new Date().toISOString();
  await supabase.from("telegram_support_threads").upsert(
    { customer_id: customer.id, is_archived: false, status: "open", updated_at: threadNow, last_customer_message_at: threadNow },
    { onConflict: "customer_id" }
  );
  // 2.1: mas'ul operatorga Telegram (throttle bilan).
  await notifyOperatorsSupportMessage(customer.id, { kind: "voice" });

  return NextResponse.json({ message: inserted });
}
