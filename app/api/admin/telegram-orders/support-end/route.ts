import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

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

  // Mijozga "hal bo'ldimi?" so'rovi (maxsus xabar). Frontend __END_CONFIRM__
  // belgisini tanib, Ha/Yo'q tugmalarini ko'rsatadi.
  await admin.from("telegram_support_messages").insert({
    customer_id: customerId,
    sender: "operator",
    message: "__END_CONFIRM__Savolingiz hal bo'ldimi? Agar boshqa savolingiz bo'lmasa, suhbatni yakunlaymiz.",
  });

  // Thread holati "yakunlanish kutilmoqda".
  await admin.from("telegram_support_threads").update({
    status: "ended_pending",
    updated_at: new Date().toISOString(),
  }).eq("customer_id", customerId);

  return NextResponse.json({ success: true });
}
