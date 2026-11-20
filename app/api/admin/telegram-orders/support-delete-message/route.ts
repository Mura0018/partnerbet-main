import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkThreadOwnership, SUPPORT_OVERRIDE_PERMISSION } from "@/lib/support/ownership";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { messageId } = body ?? {};
  if (!messageId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  // 3-band: xabar tegishli suhbat egaligi tekshiriladi.
  const { data: msgRow } = await admin.from("telegram_support_messages").select("customer_id").eq("id", messageId).maybeSingle();
  if (msgRow?.customer_id) {
    // 3-band: faqat suhbat egasi, egasiz suhbat yoki rahbar (telegram_operators.manage).
    const { data: canOverride } = await supabase.rpc("has_permission", { perm_key: SUPPORT_OVERRIDE_PERMISSION });
    const own = await checkThreadOwnership(admin, String(msgRow.customer_id), user.id, !!canOverride);
    if (!own.ok) return NextResponse.json({ error: "not_owner", ownerId: own.ownerId, ownerName: own.ownerName }, { status: 409 });
  }
  // Only ever deletes if it was this operator's own reply — never a
  // customer's message, regardless of who calls this.
  const { error } = await admin
    .from("telegram_support_messages")
    .delete()
    .eq("id", messageId)
    .eq("sender", "operator")
    .eq("operator_id", user.id);

  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}
