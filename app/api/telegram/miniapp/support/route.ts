import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

async function resolveCustomerId(initData: string, botToken: string): Promise<string | null> {
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return null;
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  return customer?.id ?? null;
}

export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const customerId = await resolveCustomerId(initData, botToken);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: messages } = await supabase
    .from("telegram_support_messages")
    .select("id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-support-send:${ip}`, 60, 20);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, message } = body ?? {};
  if (!initData || !message || String(message).trim().length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const customerId = await resolveCustomerId(initData, botToken);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("telegram_support_messages")
    .insert({ customer_id: customerId, sender: "customer", message: String(message).trim().slice(0, 2000) })
    .select("id, sender, message, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  await supabase.from("telegram_support_threads").upsert(
    { customer_id: customerId, is_archived: false, updated_at: new Date().toISOString() },
    { onConflict: "customer_id" }
  );
  return NextResponse.json({ message: inserted });
}
