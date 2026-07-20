import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Customer-facing signed URL — only for a path that actually belongs to
// one of THIS customer's own support messages (checked against the DB,
// not just trusted from the request), so one customer can never fetch
// another's attachment by guessing a path.
export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const { initData, path } = body ?? {};
  if (!initData || !path) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const { data: owns } = await supabase
    .from("telegram_support_messages")
    .select("id")
    .eq("customer_id", customer.id)
    .or(`image_path.eq.${path},voice_path.eq.${path}`)
    .maybeSingle();
  if (!owns) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabase.storage.from("support-attachments").createSignedUrl(path, 300);
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ url: data.signedUrl });
}
