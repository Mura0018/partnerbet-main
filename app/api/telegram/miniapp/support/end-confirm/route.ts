import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const { initData, resolved } = body ?? {};
  if (!initData || typeof resolved !== "boolean") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  const customerId = customer?.id;
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const nowIso = new Date().toISOString();

  if (resolved) {
    await supabase.from("telegram_support_messages").insert({
      customer_id: customerId,
      sender: "operator",
      message: "Yordamimizdan foydalanganingiz uchun rahmat! Yana savolingiz bo'lsa, istalgan vaqtda yozing. Sizga omad!",
    });
    await supabase.from("telegram_support_threads").update({
      status: "ended",
      is_archived: true,
      ended_at: nowIso,
      claimed_by: null,
      claimed_at: null,
      updated_at: nowIso,
    }).eq("customer_id", customerId);
  } else {
    await supabase.from("telegram_support_threads").update({
      status: "open",
      updated_at: nowIso,
    }).eq("customer_id", customerId);
  }

  return NextResponse.json({ ok: true, resolved });
}
