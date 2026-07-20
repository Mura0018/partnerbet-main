import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Soft claim: if the order is still unclaimed, this operator takes it.
// If someone else already claimed it, we don't overwrite — we just report
// who has it, so the UI can show "Ali ko'rib chiqmoqda" without blocking
// anyone (the real double-processing guard is the `.eq("status","pending")`
// check in /api/admin/telegram-orders/status, not this).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { orderId } = body ?? {};
  if (!orderId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  await admin
    .from("telegram_orders")
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending")
    .is("claimed_by", null);

  const { data: order } = await admin.from("telegram_orders").select("claimed_by").eq("id", orderId).maybeSingle();
  return NextResponse.json({ claimedBy: order?.claimed_by ?? null });
}
