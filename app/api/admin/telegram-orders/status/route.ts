import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, buildOrderResolvedMessage } from "@/lib/telegram/notify";
import { cashdeskDeposit, cashdeskPayout, isCashdeskConfigured } from "@/lib/cashdesk/client";

async function requireOrdersManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return { ok: false as const, status: 403 };

  return { ok: true as const, userId: user.id };
}

// Routed through this endpoint (rather than a direct client-side RLS
// update) specifically so a status change always (a) calls the real
// cashdesk Deposit/Payout API when "completed" and credentials are
// configured, and (b) triggers the customer's Telegram notification —
// the admin UI never updates order status any other way.
export async function POST(req: NextRequest) {
  const check = await requireOrdersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { orderId, status, note } = body ?? {};
  if (!orderId || (status !== "completed" && status !== "rejected")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up the order first (without mutating it) so we know what to
  // send to the cashdesk API before committing to "completed".
  const { data: pendingOrder } = await admin
    .from("telegram_orders")
    .select("id, type, amount, account_id, withdraw_code, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!pendingOrder || pendingOrder.status !== "pending") {
    return NextResponse.json({ error: "not_found_or_already_resolved" }, { status: 409 });
  }

  let autoProcessed = false;
  let operatorNote = note ? String(note).trim().slice(0, 500) : null;

  if (status === "completed" && (await isCashdeskConfigured())) {
    const result =
      pendingOrder.type === "topup"
        ? await cashdeskDeposit(pendingOrder.account_id, Number(pendingOrder.amount))
        : await cashdeskPayout(pendingOrder.account_id, pendingOrder.withdraw_code ?? "");

    if (!result.ok) {
      // Do NOT mark the order completed if the real money movement
      // failed — the operator sees exactly why and can retry or escalate.
      return NextResponse.json({ error: "cashdesk_failed", detail: result.error }, { status: 502 });
    }
    autoProcessed = true;
    operatorNote = operatorNote
      ? `${operatorNote} (API orqali avtomatik bajarildi)`
      : "API orqali avtomatik bajarildi";
  }

  const { data: order, error } = await admin
    .from("telegram_orders")
    .update({
      status,
      operator_id: check.userId,
      operator_note: operatorNote,
      auto_processed: autoProcessed,
    })
    .eq("id", orderId)
    .eq("status", "pending") // still guards against a concurrent resolve between our read and this write
    .select("id, type, amount, customer_id, customers(telegram_id)")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "not_found_or_already_resolved" }, { status: 409 });
  }

  // 2-BOSQICH: mijoz egaligini birinchi BAJARILGAN buyurtmada o'rnatish.
  // Faqat completed va faqat egasi BO'SH bo'lsa (.is(...,null) bilan atomik) —
  // birinchi egasi doim qoladi. Best-effort: bu yerdagi xato resolve oqimini
  // buzmaydi (pul allaqachon ko'chgan bo'lishi mumkin).
  if (status === "completed" && (order as any).customer_id) {
    try {
      await admin
        .from("customers")
        .update({ owner_operator_id: check.userId })
        .eq("id", (order as any).customer_id)
        .is("owner_operator_id", null);
    } catch {
      /* egalik biriktirish best-effort */
    }
  }

  const telegramId = (order as any).customers?.telegram_id;
  if (telegramId) {
    await sendTelegramMessage(telegramId, buildOrderResolvedMessage(order.type, Number(order.amount), status, note));
  }

  return NextResponse.json({ success: true, autoProcessed });
}
