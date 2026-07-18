import { NextRequest, NextResponse } from "next/server";
import { createPublicServerClient } from "@/lib/supabasePublic";
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

  // Public delete-by-endpoint is allowed by RLS (see migration 0028) — the
  // endpoint value itself acts as the visitor's own unguessable token.
  const supabase = createPublicServerClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ success: true });
}
