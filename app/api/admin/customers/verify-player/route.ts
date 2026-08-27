import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { findCashdeskPlayer } from "@/lib/cashdesk/client";

export const dynamic = "force-dynamic";

// 1xBet ID -> ism-familiya (findCashdeskPlayer). ID QO'SHISHDA/TASDIQLASHDA
// operator saqlashdan OLDIN chaqiradi — ism topilsa "ha, shu odam" deb
// tasdiqlaydi (verified=true). API javob bermasa/ism topilmasa -> ok:false
// (saqlash mumkin, lekin verified=false qoladi). PUL HARAKATI YO'Q (faqat lookup).
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const pid = String(req.nextUrl.searchParams.get("playerId") ?? "").trim().slice(0, 50);
  if (!pid) return NextResponse.json({ ok: false, error: "invalid" });

  try {
    const res = await findCashdeskPlayer(pid);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error });
    const name = String(res.data.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "no_name" });
    return NextResponse.json({ ok: true, name, currencyId: res.data.currencyId != null ? String(res.data.currencyId) : null });
  } catch {
    return NextResponse.json({ ok: false, error: "network_error" });
  }
}
