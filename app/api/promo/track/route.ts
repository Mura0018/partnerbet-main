import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

// Public endpoint: increments a promo code's usage_count when a visitor
// taps "Copy code". Uses the service-role client because promo_codes'
// RLS intentionally only grants public SELECT, not UPDATE (a visitor
// must not be able to write anything else on the row).
export async function POST(req: NextRequest) {
  let body: { promoCodeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.promoCodeId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`promo-track:${ip}`, 60, 20);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = createAdminClient();
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("usage_count")
    .eq("id", body.promoCodeId)
    .eq("is_active", true)
    .maybeSingle();

  if (!promo) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabase
    .from("promo_codes")
    .update({ usage_count: (promo.usage_count ?? 0) + 1 })
    .eq("id", body.promoCodeId);

  return NextResponse.json({ success: true });
}
