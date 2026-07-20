import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getCashdeskBalance } from "@/lib/cashdesk/client";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await getCashdeskBalance();
  if (!result.ok) return NextResponse.json({ configured: result.error !== "not_configured", error: result.error }, { status: 200 });

  return NextResponse.json({ configured: true, balance: result.data.Balance, limit: result.data.Limit }, { headers: { "Cache-Control": "no-store" } });
}
