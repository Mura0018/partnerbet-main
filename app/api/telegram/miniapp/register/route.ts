import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-register:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, phone, password, fullName } = body ?? {};
  if (!initData || !phone || !password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: existingPhone } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (existingPhone) return NextResponse.json({ error: "phone_taken" }, { status: 409 });

  const { data: existingTelegram } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  if (existingTelegram) return NextResponse.json({ error: "telegram_already_linked" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: customer, error } = await supabase
    .from("customers")
    .insert({ phone, password_hash: passwordHash, full_name: fullName ?? null, telegram_id: verified.telegramId, partner_id: verified.partnerId })
    .select("id, full_name, phone")
    .single();

  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ customer });
}
