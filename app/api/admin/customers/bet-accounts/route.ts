import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Mijozning 1xBet ID larini boshqarish. Pul harakati YO'Q. telegram_orders.manage.
//  - add     : yangi ID qo'shish. verified faqat operator findCashdeskPlayer
//              bilan tasdiqlagach true (aks holda false — "taxmin" qoladi).
//  - verify  : mavjud ID ni tasdiqlash (verified=true, source='operator').
//  - primary : asosiy ID ni o'zgartirish. QAYD ETILADI (kim, qachon) — asosiy
//              ID depozit uchun standart tanlov, ya'ni pulga ta'sir qiladigan qaror.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const customerId = String(body?.customerId ?? "").trim();
  const action = String(body?.action ?? "");
  const playerId = String(body?.playerId ?? "").trim().slice(0, 50);
  if (!customerId || !playerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: customer } = await admin.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  const nowIso = new Date().toISOString();

  // ---- ADD ----
  if (action === "add") {
    const playerName = body?.playerName ? String(body.playerName).trim().slice(0, 200) : null;
    const currencyId = body?.currencyId ? String(body.currencyId).trim().slice(0, 20) : null;
    const verified = body?.verified === true;

    const { data: existing } = await admin
      .from("customer_bet_accounts")
      .select("id, is_primary")
      .eq("customer_id", customerId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (existing) {
      await admin
        .from("customer_bet_accounts")
        .update({ player_name: playerName, currency_id: currencyId, verified, source: "operator", name_checked_at: verified ? nowIso : null })
        .eq("id", (existing as any).id);
      return NextResponse.json({ ok: true, updated: true });
    }

    // Birinchi ID bo'lsa -> asosiy.
    const { count } = await admin.from("customer_bet_accounts").select("id", { count: "exact", head: true }).eq("customer_id", customerId);
    const isPrimary = (count ?? 0) === 0;

    const { error } = await admin.from("customer_bet_accounts").insert({
      customer_id: customerId,
      player_id: playerId,
      player_name: playerName,
      currency_id: currencyId,
      verified,
      source: "operator",
      name_checked_at: verified ? nowIso : null,
      is_primary: isPrimary,
    });
    if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ---- VERIFY ----
  if (action === "verify") {
    const playerName = body?.playerName ? String(body.playerName).trim().slice(0, 200) : null;
    const { data: updated } = await admin
      .from("customer_bet_accounts")
      .update({ verified: true, source: "operator", player_name: playerName, name_checked_at: nowIso })
      .eq("customer_id", customerId)
      .eq("player_id", playerId)
      .select("id");
    if (!updated || updated.length === 0) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // ---- SET PRIMARY (qayd etiladi) ----
  if (action === "primary") {
    const { data: target } = await admin
      .from("customer_bet_accounts")
      .select("id")
      .eq("customer_id", customerId)
      .eq("player_id", playerId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

    // Eski asosiy (qayd uchun).
    const { data: oldPrimary } = await admin
      .from("customer_bet_accounts")
      .select("player_id")
      .eq("customer_id", customerId)
      .eq("is_primary", true)
      .maybeSingle();
    const oldPid = (oldPrimary as any)?.player_id ?? null;

    if (oldPid === playerId) return NextResponse.json({ ok: true, unchanged: true });

    // Avval hammasini false, keyin maqsadni true (partial unique buzilmasin).
    await admin.from("customer_bet_accounts").update({ is_primary: false }).eq("customer_id", customerId).eq("is_primary", true);
    await admin.from("customer_bet_accounts").update({ is_primary: true }).eq("id", (target as any).id);

    // QAYD: kim, qachon (asosiy ID depozit uchun standart -> pulga ta'sir qiladi).
    try {
      const { data: me } = await admin.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle();
      const name = (me as any)?.display_name || (me as any)?.full_name || "Operator";
      await admin.from("team_chat_messages").insert({
        sender_id: user.id,
        is_system: true,
        event_type: "alert",
        message: `🔑 Tizim: ${name} mijoz (${customerId}) asosiy 1xBet ID sini ${oldPid ? `${oldPid} -> ` : ""}${playerId} ga o'zgartirdi. (Asosiy ID depozit uchun standart tanlov.)`,
      });
    } catch {
      /* qayd best-effort */
    }
    return NextResponse.json({ ok: true, oldPrimary: oldPid, newPrimary: playerId });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
