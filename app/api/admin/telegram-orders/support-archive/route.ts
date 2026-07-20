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
  const { customerId, archived } = body ?? {};
  if (!customerId || typeof archived !== "boolean") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("telegram_support_threads").upsert(
    {
      customer_id: customerId,
      is_archived: archived,
      archived_by: archived ? user.id : null,
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" }
  );

  return NextResponse.json({ success: true });
}
