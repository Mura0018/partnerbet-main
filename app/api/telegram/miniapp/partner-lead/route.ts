import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

// Hamkorlik so'rovi (lead) — mijoz appdan super admin inboxiga.
// Klient bazaga to'g'ridan tegmaydi; bu yerda initData tekshiriladi va
// yozuv service role bilan qo'shiladi.
export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`partner-lead:${ip}`, 3600, 5);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }

  const initData = body?.initData;
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, phone, full_name")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();

  const name = (body.name ?? customer?.full_name ?? "").toString().trim().slice(0, 120) || null;
  const phone = (body.phone ?? customer?.phone ?? "").toString().trim().slice(0, 40) || null;
  const company = (body.company ?? "").toString().trim().slice(0, 120) || null;
  const message = (body.message ?? "").toString().trim().slice(0, 1000) || null;

  const { error } = await supabase.from("partner_leads").insert({
    customer_id: customer?.id ?? null,
    name,
    phone,
    company,
    message,
    status: "new",
  });
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
