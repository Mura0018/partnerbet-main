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
  const { allowed } = await checkAndRecordRateLimit(`telegram-receipt-upload:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, orderId, imageBase64, mimeType } = body ?? {};
  if (!initData || !orderId || !imageBase64 || !mimeType) {
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

  // Only the order's own owner can attach a receipt to it, and only
  // while it's still pending — this can't be used to tamper with an
  // already-resolved order.
  const { data: order } = await supabase
    .from("telegram_orders")
    .select("id, type, status, customer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.customer_id !== customer.id || order.type !== "topup" || order.status !== "pending") {
    return NextResponse.json({ error: "invalid_order" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageBase64, "base64");
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_image_size" }, { status: 400 });
  }

  const path = `${customer.id}/${orderId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("receipts").upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  await supabase.from("telegram_orders").update({ receipt_path: path }).eq("id", orderId);

  return NextResponse.json({ success: true });
}
