import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { normalizeCardCode } from "@/lib/cards/generateCode";

export const dynamic = "force-dynamic";

// Aktiv kartani bekor qilish. QAYTARIB BO'LMAYDI -> UI tasdiqlash oynasi +
// SABAB majburiy. Boshqa operator biriktirgan kartani ham bekor qilish mumkin
// (cancelled_by yoziladi — kim bekor qilgani ko'rinadi). Pul harakati yo'q.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const code = normalizeCardCode(body?.code ?? "");
  const reason = body?.reason ? String(body.reason).trim().slice(0, 500) : "";
  if (!code) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: card } = await admin.from("promo_cards").select("id, status").eq("card_code", code).maybeSingle();
  if (!card) return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  if ((card as any).status !== "assigned") {
    return NextResponse.json({ error: "not_assigned", status: (card as any).status }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: cancelled } = await admin
    .from("promo_cards")
    .update({ status: "cancelled", cancelled_at: nowIso, cancelled_by: user.id, cancel_reason: reason })
    .eq("id", (card as any).id)
    .eq("status", "assigned") // atomik — orada boshqa kimdir bekor qilmagan bo'lsa
    .select("id");

  if (!cancelled || cancelled.length === 0) {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
