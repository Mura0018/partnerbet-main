import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const { initData } = await req.json().catch(() => ({ initData: null }));
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();

  if (!customer) return NextResponse.json({ registered: false });
  return NextResponse.json({ registered: true, customer });
}
