import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const { initData, messageId } = body ?? {};
  if (!initData || !messageId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("telegram_id", verified.telegramId).maybeSingle();
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  // Only ever deletes if it was this customer's own message.
  const { error } = await supabase
    .from("telegram_support_messages")
    .delete()
    .eq("id", messageId)
    .eq("sender", "customer")
    .eq("customer_id", customer.id);

  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
