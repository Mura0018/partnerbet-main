import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getCashdeskBalance } from "@/lib/cashdesk/client";
import { startTimeout } from "@/lib/net/timeout";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // 5s timeout (faqat o'qish) — abort -> network_error, javob shakli o'zgarmaydi.
  const tmo = startTimeout(5000);
  let result: Awaited<ReturnType<typeof getCashdeskBalance>>;
  try {
    result = await getCashdeskBalance(undefined, { signal: tmo.signal });
  } finally {
    tmo.clear();
  }
  if (!result.ok) return NextResponse.json({ configured: result.error !== "not_configured", error: result.error }, { status: 200 });

  return NextResponse.json({ configured: true, balance: result.data.Balance, limit: result.data.Limit }, { headers: { "Cache-Control": "no-store" } });
}
