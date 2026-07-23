import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";

async function resolveCustomerId(initData: string): Promise<string | null> {
  const verified = await resolveMiniApp(initData);
  if (!verified) return null;
  const supabase = createAdminClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("telegram_id", verified.telegramId).maybeSingle();
  return customer?.id ?? null;
}

export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const customerId = await resolveCustomerId(initData);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase.from("customers").select("chat_theme").eq("id", customerId).maybeSingle();
  return NextResponse.json({ theme: data?.chat_theme ?? "blue" });
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const { initData, theme } = body ?? {};
  if (!initData || !theme) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const customerId = await resolveCustomerId(initData);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  await supabase.from("customers").update({ chat_theme: String(theme).slice(0, 20) }).eq("id", customerId);
  return NextResponse.json({ success: true });
}
