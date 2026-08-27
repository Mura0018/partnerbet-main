import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { normalizeCardCode } from "@/lib/cards/generateCode";

export const dynamic = "force-dynamic";

// Blank kartani mijozga biriktirish. Pul harakati YO'Q. telegram_orders.manage.
// Mijozda aktiv karta bo'lsa -> 409 customer_has_card (eski karta ma'lumoti
// bilan) -> UI ogohlantiradi. replaceReason bilan qayta chaqirilsa: yangi
// karta blankligi TEKSHIRILADI -> eski BEKOR qilinadi (log) -> yangi biriktiriladi.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const code = normalizeCardCode(body?.code ?? "");
  const customerId = String(body?.customerId ?? "").trim();
  const replaceReason = body?.replaceReason ? String(body.replaceReason).trim().slice(0, 500) : null;
  if (!code || !customerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();

  // Yangi karta — AVVAL blankligini tekshiramiz (eskisi bekor qilinishidan oldin).
  const { data: card } = await admin.from("promo_cards").select("id, status, customer_id").eq("card_code", code).maybeSingle();
  if (!card) return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  if ((card as any).status !== "blank") return NextResponse.json({ error: "card_not_blank", status: (card as any).status }, { status: 409 });

  const { data: customer } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  // Mijozda aktiv karta bormi?
  const { data: active } = await admin
    .from("promo_cards")
    .select("id, card_code")
    .eq("customer_id", customerId)
    .eq("status", "assigned")
    .limit(1)
    .maybeSingle();

  if (active && !replaceReason) {
    // UI ogohlantiradi: "bu mijozda karta bor, eskisi bekor qilinadimi?"
    return NextResponse.json({ error: "customer_has_card", existing: { code: (active as any).card_code } }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  // Eskisini bekor qilamiz (log: cancelled_by + sabab). Qaytarilmaydi.
  if (active && replaceReason) {
    await admin
      .from("promo_cards")
      .update({ status: "cancelled", cancelled_at: nowIso, cancelled_by: user.id, cancel_reason: replaceReason })
      .eq("id", (active as any).id)
      .eq("status", "assigned");
  }

  // Yangisini biriktiramiz — ATOMIK (faqat status='blank' bo'lsa).
  const { data: assigned } = await admin
    .from("promo_cards")
    .update({ status: "assigned", customer_id: customerId, assigned_at: nowIso, assigned_by: user.id })
    .eq("id", (card as any).id)
    .eq("status", "blank")
    .select("id");

  if (!assigned || assigned.length === 0) {
    // Yangi karta biriktirilmadi (boshqa kimdir tegdi). Agar eski allaqachon
    // bekor qilingan bo'lsa -> ORALIQ HOLAT: mijoz kartasiz qoldi. Bu
    // QAYTARILADIGAN (mijoz ID orqali topiladi) va pulga ta'sir qilmaydi.
    // Jamoa chatiga ANIQ signal (sababi topilsin, operator boshqa blank
    // kartani biriktirsin).
    if (active && replaceReason) {
      try {
        await admin.from("team_chat_messages").insert({
          sender_id: user.id,
          is_system: true,
          event_type: "alert",
          message:
            `⚠️ Tizim: karta almashtirishda ORALIQ HOLAT — eski karta ${(active as any).card_code} BEKOR qilindi, ` +
            `lekin yangi ${code} biriktirilmadi. Mijoz (${customerId}) hozircha kartasiz (ID orqali topiladi). ` +
            `Boshqa blank kartani biriktiring. Sabab: yangi karta band/o'zgargan.`,
        });
      } catch {
        /* signal best-effort */
      }
    }
    return NextResponse.json({ error: "assign_failed_retry" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, replaced: !!(active && replaceReason) });
}
