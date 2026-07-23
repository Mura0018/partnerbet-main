import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Mijoz chatdan chiqqanda: joriy suhbatni MIJOZ ko'rinishidan yashiramiz
// (thread.ended_at = now). Operator paneli to'liq tarixni saqlaydi (u ended_at
// bo'yicha filtrlamaydi). Keyingi kirishda mijozga faqat shundan keyingi
// (yangi) xabarlar ko'rinadi -> "bo'sh chat". Faqat ended_at yangilanadi —
// arxivlash / greeting reset / status kabi yon-ta'sirlar YO'Q.
export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const initData = body?.initData;
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  await supabase
    .from("telegram_support_threads")
    .update({ ended_at: new Date().toISOString() })
    .eq("customer_id", customer.id);

  return NextResponse.json({ ok: true });
}
