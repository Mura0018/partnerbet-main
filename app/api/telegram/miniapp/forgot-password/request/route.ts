import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Always responds { success: true } regardless of whether the phone
// exists — this endpoint must not let a caller enumerate registered
// phone numbers. A code is only actually sent when the phone matches an
// account that already has a linked Telegram chat.
export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-reset-request:${ip}`, 300, 5);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, phone } = body ?? {};
  if (!initData || !phone) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, telegram_id")
    .eq("phone", String(phone).trim())
    .maybeSingle();

  if (customer?.telegram_id) {
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("customers").update({ reset_code_hash: codeHash, reset_code_expires_at: expiresAt }).eq("id", customer.id);
    await sendTelegramMessage(
      customer.telegram_id,
      `🔑 Parolni tiklash kodi: ${code}\n\nBu kod 10 daqiqa amal qiladi. Agar buni siz so'ramagan bo'lsangiz, e'tiborsiz qoldiring.`
    );
  }

  return NextResponse.json({ success: true });
}
