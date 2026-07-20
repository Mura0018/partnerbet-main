import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const ALLOWED_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};
const MAX_BYTES = 8 * 1024 * 1024;

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
    contentType: mimeType,
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
      voice_duration_seconds: Number(durationSeconds) || null,
    })
    .select("id, created_at")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  const { data: customer } = await admin.from("customers").select("telegram_id").eq("id", customerId).maybeSingle();
  if (customer?.telegram_id) {
    await sendTelegramMessage(customer.telegram_id, "🟦 BETCORE PAY\n\n🎤 Operatordan ovozli xabar keldi. Ilovada tinglang.");
  }

  return NextResponse.json({ success: true });
}
