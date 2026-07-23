import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-login:${ip}`, 60, 15);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, phone, password } = body ?? {};
  if (!initData || !phone || !password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, phone, password_hash, telegram_id, partner_id")
    .eq("phone", phone)
    .maybeSingle();

  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Kirish qoidasi: hamkor app'iga faqat o'sha hamkor mijozi. Begona => jim rad (not_found).
  if (verified.partnerId && (customer as any).partner_id !== verified.partnerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const passwordOk = await bcrypt.compare(password, customer.password_hash);
  if (!passwordOk) return NextResponse.json({ error: "wrong_password" }, { status: 401 });

  if (customer.telegram_id && customer.telegram_id !== verified.telegramId) {
    return NextResponse.json({ error: "linked_to_other_telegram" }, { status: 409 });
  }

  if (!customer.telegram_id) {
    await supabase.from("customers").update({ telegram_id: verified.telegramId }).eq("id", customer.id);
  }

  return NextResponse.json({ customer: { id: customer.id, full_name: customer.full_name, phone: customer.phone } });
}
