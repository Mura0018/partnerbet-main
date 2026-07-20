import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

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
// update) specifically so a status change always triggers the customer's
// Telegram notification in the same request — the admin UI never updates
// order status any other way.
export async function POST(req: NextRequest) {
  const check = await requireOrdersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { orderId, status, note } = body ?? {};
  if (!orderId || (status !== "completed" && status !== "rejected")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("telegram_orders")
    .update({
      status,
      operator_id: check.userId,
      operator_note: note ? String(note).trim().slice(0, 500) : null,
    })
    .eq("id", orderId)
    .eq("status", "pending") // can only resolve orders still pending — no re-flipping a decided order
    .select("id, type, amount, customer_id, customers(telegram_id)")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "not_found_or_already_resolved" }, { status: 409 });
  }

  const telegramId = (order as any).customers?.telegram_id;
  if (telegramId) {
    const label = order.type === "topup" ? "Hisob to'ldirish" : "Pul yechish";
    const amountText = Number(order.amount).toLocaleString("ru-RU");
    const text =
      status === "completed"
        ? `✅ ${label} buyurtmangiz (${amountText}) BAJARILDI.${note ? `\n\nOperator izohi: ${note}` : ""}`
        : `❌ ${label} buyurtmangiz (${amountText}) RAD ETILDI.${note ? `\n\nSabab: ${note}` : "\n\nBatafsil uchun operator bilan bog'laning."}`;
    await sendTelegramMessage(telegramId, text);
  }

  return NextResponse.json({ success: true });
}
