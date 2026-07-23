import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { findCashdeskPlayer, isCashdeskConfigured } from "@/lib/cashdesk/client";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`verify-player:${ip}`, 60, 30);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, accountId } = body ?? {};
  if (!initData || !accountId || !String(accountId).trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("telegram_id", verified.telegramId).maybeSingle();
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const configured = await isCashdeskConfigured();
  if (!configured) return NextResponse.json({ error: "not_configured" });

  const lookup = await findCashdeskPlayer(String(accountId).trim());
  if (!lookup.ok) return NextResponse.json({ error: "not_found" });

  return NextResponse.json({ playerName: lookup.data.name });
}
