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
  const { messageId } = body ?? {};
  if (!messageId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
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
