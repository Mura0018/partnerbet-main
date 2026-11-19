import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resetSupportNoticeFlags } from "@/lib/support/messages";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const ALLOWED_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};
// 1.5: mijoz bilan bir xil 3 MB (bucket 5 MB, so'rov tanasi chegarasi);
// operator davomiyligi 300 s gacha (avval umuman tekshirilmasdi).
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_DURATION_SECONDS = 300;

function extFor(mimeType: string): string | null {
  const base = mimeType.split(";")[0].trim();
  return ALLOWED_MIME[base] ?? null;
}

// Browser-recorded audio isn't in a format Telegram's sendVoice API can
// reliably play as a native voice bubble, so the customer's Telegram
// notification is a text nudge to open the app — the actual audio is
// only played back inside the Mini App / admin panel.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { customerId, audioBase64, mimeType, durationSeconds } = body ?? {};
  if (!customerId || !audioBase64 || !mimeType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const ext = extFor(mimeType);
  if (!ext) return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
  const duration = Math.round(Number(durationSeconds));
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }
  // Dekod qilishdan OLDIN base64 uzunligi tekshiriladi (katta tanani bekor
  // xotiraga olmaslik uchun). Buffer.from base64'da xato tashlamaydi.
  if (typeof audioBase64 !== "string" || audioBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) {
    return NextResponse.json({ error: "invalid_audio_size" }, { status: 400 });
  }

  const admin = createAdminClient();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(audioBase64, "base64");
  } catch {
    return NextResponse.json({ error: "invalid_audio" }, { status: 400 });
  }
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_audio_size" }, { status: 400 });
  }

  const path = `${customerId}/operator-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage.from("support-attachments").upload(path, buffer, {
    contentType: mimeType.split(";")[0].trim(),
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data: inserted, error } = await admin
    .from("telegram_support_messages")
    .insert({
      customer_id: customerId,
      sender: "operator",
      operator_id: user.id,
      voice_path: path,
      voice_duration_seconds: duration,
    })
    .select("id, created_at")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  // Operator javob berdi:
  //  - last_operator_reply_at (0057 dan bor, lekin hech qayerda YOZILMASDI —
  //    shu sababli cron operator javob bergan suhbatni ham 15 daq'da olib
  //    qo'yardi; endi "javobsiz" hisobi va stale tekshiruvi to'g'ri);
  //  - "band" ogohlantirishi va operator bildirishnomasi belgilari tozalanadi
  //    (1.1 / 2.1) — keyingi uzilishda yana bir marta, hisob qaytadan.
  try {
    const replyNow = new Date().toISOString();
    await admin
      .from("telegram_support_threads")
      .update({ last_operator_reply_at: replyNow, updated_at: replyNow })
      .eq("customer_id", customerId);
  } catch {
    /* best-effort */
  }
  await resetSupportNoticeFlags(admin, customerId);

  const { data: customer } = await admin.from("customers").select("telegram_id").eq("id", customerId).maybeSingle();
  if (customer?.telegram_id) {
    await sendTelegramMessage(customer.telegram_id, "🟦 DedPay\n\n🎤 Operatordan ovozli xabar keldi. Ilovada tinglang.");
  }

  return NextResponse.json({ success: true });
}
