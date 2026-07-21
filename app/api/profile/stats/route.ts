import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();

  const [{ count: resolvedOrders }, { count: supportReplies }] = await Promise.all([
    admin
      .from("telegram_orders")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", user.id)
      .in("status", ["completed", "rejected"])
      .gte("updated_at", since),
    admin
      .from("telegram_support_messages")
      .select("id", { count: "exact", head: true })
      .eq("operator_id", user.id)
      .eq("sender", "operator")
      .gte("created_at", since),
  ]);

  return NextResponse.json({
    resolvedOrders: resolvedOrders ?? 0,
    supportReplies: supportReplies ?? 0,
  });
}
