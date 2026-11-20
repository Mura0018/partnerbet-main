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
  const { customerId } = body ?? {};
  if (!customerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  // 3-band: faqat suhbat egasi, egasiz suhbat yoki rahbar (telegram_operators.manage).
  const { data: canOverride } = await supabase.rpc("has_permission", { perm_key: SUPPORT_OVERRIDE_PERMISSION });
  const own = await checkThreadOwnership(admin, String(customerId), user.id, !!canOverride);
  if (!own.ok) return NextResponse.json({ error: "not_owner", ownerId: own.ownerId, ownerName: own.ownerName }, { status: 409 });

  // Mijozga "hal bo'ldimi?" so'rovi (maxsus xabar). Frontend __END_CONFIRM__
  // belgisini tanib, Ha/Yo'q tugmalarini ko'rsatadi.
  const { error: msgErr } = await admin.from("telegram_support_messages").insert({
    customer_id: customerId,
    sender: "operator",
    operator_id: user.id,
    message: "__END_CONFIRM__Savolingiz hal bo'ldimi? \ud83e\udd14 Agar boshqa savolingiz bo'lmasa, suhbatni yakunlaymiz.",
  });

  const { error: thrErr } = await admin.from("telegram_support_threads").update({
    status: "ended_pending",
    updated_at: new Date().toISOString(),
  }).eq("customer_id", customerId);

  if (msgErr || thrErr) {
    return NextResponse.json({ error: "db_error", msgErr: msgErr?.message, thrErr: thrErr?.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
