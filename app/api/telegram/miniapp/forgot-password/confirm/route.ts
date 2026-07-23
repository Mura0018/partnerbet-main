import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-reset-confirm:${ip}`, 300, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, phone, code, newPassword } = body ?? {};
  if (!initData || !phone || !code || !newPassword) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  // initData imzosini tekshirish — confirm endi Telegram kontekstisiz
  // chaqirilmaydi (ilgari faqat phone+code+newPassword yetardi).
  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Per-telefon rate-limit — IPdan qat'iy nazar taqsimlangan (botnet)
  // brute-force'ni to'xtatadi. 5 urinish / 10 daqiqa (kod amal muddatiga mos).
  const { allowed: phoneAllowed } = await checkAndRecordRateLimit(
    `telegram-reset-confirm-phone:${String(phone).trim()}`,
    600,
    5
  );
  if (!phoneAllowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, telegram_id, reset_code_hash, reset_code_expires_at")
    .eq("phone", String(phone).trim())
    .maybeSingle();

  if (!customer?.reset_code_hash || !customer.reset_code_expires_at) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  // Kodni faqat bog'langan Telegram akkaunt egasi tasdiqlashi mumkin. Kod
  // shu telegram_id'ga yuborilgan (0037/request), shuning uchun bu haqiqiy
  // oqimga regressiya bermaydi — faqat begona akkauntdan brute-force'ni yopadi.
  // (invalid_code qaytariladi, telefon mavjudligini oshkor qilmaslik uchun.)
  if (customer.telegram_id !== verified.telegramId) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (new Date(customer.reset_code_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }

  const codeOk = await bcrypt.compare(String(code).trim(), customer.reset_code_hash);
  if (!codeOk) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const newHash = await bcrypt.hash(String(newPassword), 10);
  await supabase
    .from("customers")
    .update({ password_hash: newHash, reset_code_hash: null, reset_code_expires_at: null })
    .eq("id", customer.id);

  return NextResponse.json({ success: true });
}
