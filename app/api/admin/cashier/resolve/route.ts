import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { normalizeCardCode } from "@/lib/cards/generateCode";
import { findCashdeskPlayer } from "@/lib/cashdesk/client";
import { loadCustomerPayload } from "@/lib/customers/cashierPayload";

export const dynamic = "force-dynamic";

// Kassa oynasi — mijozni ANIQLASH. Ikki yo'l TENG: QR (card=) yoki 1xBet ID
// (playerId=). ID mijozga bog'lanmagan bo'lsa findCashdeskPlayer bilan
// ism-familiya olinadi (kartasiz/bog'lanmagan mijoz ham xizmat oladi).
// PUL HARAKATI YO'Q — findCashdeskPlayer faqat ism qidiradi (Deposit/Payout emas).
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const codeParam = req.nextUrl.searchParams.get("code");
  const playerIdParam = req.nextUrl.searchParams.get("playerId");

  // ---- QR / karta kodi ----
  if (codeParam) {
    const code = normalizeCardCode(codeParam);
    if (!code) return NextResponse.json({ found: false, reason: "invalid" });
    const { data: card } = await admin.from("promo_cards").select("customer_id, status").eq("card_code", code).maybeSingle();
    if (!card) return NextResponse.json({ found: false, reason: "card_not_found", code });
    const status = (card as any).status ?? "assigned";
    if (status === "blank") return NextResponse.json({ found: false, reason: "card_blank", code });
    if (status === "cancelled") return NextResponse.json({ found: false, reason: "card_cancelled", code });
    if (!(card as any).customer_id) return NextResponse.json({ found: false, reason: "card_blank", code });
    const payload = await loadCustomerPayload(admin, (card as any).customer_id);
    if (!payload) return NextResponse.json({ found: false, reason: "customer_missing" });
    return NextResponse.json({ found: true, via: "card", cardCode: code, ...payload });
  }

  // ---- 1xBet ID (qo'lda) ----
  if (playerIdParam) {
    const pid = String(playerIdParam).trim().slice(0, 50);
    if (!pid) return NextResponse.json({ found: false, reason: "invalid" });

    // Bog'langanmi?
    const { data: acc } = await admin
      .from("customer_bet_accounts")
      .select("customer_id")
      .eq("player_id", pid)
      .limit(1)
      .maybeSingle();
    if (acc && (acc as any).customer_id) {
      const payload = await loadCustomerPayload(admin, (acc as any).customer_id);
      if (payload) return NextResponse.json({ found: true, via: "player_id", playerId: pid, ...payload });
    }

    // Bog'lanmagan -> findCashdeskPlayer bilan ism (API ishlamasa null).
    let name: string | null = null;
    try {
      const res = await findCashdeskPlayer(pid);
      if (res.ok) name = String(res.data.name ?? "").trim() || null;
    } catch {
      /* API xato -> name null */
    }
    return NextResponse.json({ found: false, reason: "unlinked", lookup: { player_id: pid, name } });
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
