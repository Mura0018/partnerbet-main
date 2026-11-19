import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`push-unsubscribe:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Faqat shu endpoint (taxmin qilib bo'lmaydigan, tashrifchining o'z tokeni)
  // o'chiriladi — server (service role) orqali. 0103 dan keyin brauzer/anon
  // uchun push_subscriptions'ga yozish policy'si yo'q.
  const supabase = createAdminClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ success: true });
}
