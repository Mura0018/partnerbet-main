import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { notifyOperatorsNewOrder } from "@/lib/telegram/notifyStaff";
import { sendTelegramMessage, buildOrderCreatedMessage } from "@/lib/telegram/notify";

const PAYMENT_METHODS = ["click", "payme", "card", "crypto"];

// WITHDRAW A-OQIMI, 3-4 qadam: pul allaqачон tortilган buyurtмага usul +
// rekvизит + (ixtiyoriy) F.I.Sh. yoziladi va operatorларга xabar beriladi.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { initData, orderId, paymentMethod, payoutDetails, recipientName } = body ?? {};
  if (!initData || !orderId || !payoutDetails) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!PAYMENT_METHODS.includes(paymentMethod)) return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, customer_id, type, status, amount, account_id, player_name, payout_done")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || (order as any).customer_id !== cc.customer.id || (order as any).type !== "withdraw" || (order as any).status !== "pending") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const patch: Record<string, any> = {
    payment_method: paymentMethod,
    payout_details: String(payoutDetails).trim().slice(0, 500),
  };
  if (recipientName && String(recipientName).trim()) patch.recipient_name = String(recipientName).trim().slice(0, 150);

  const { error } = await admin.from("telegram_orders").update(patch).eq("id", orderId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  // Operatorларга xabar + mijozга tasdiq (best-effort).
  try {
    await notifyOperatorsNewOrder("withdraw", Number((order as any).amount), (order as any).player_name ?? (order as any).account_id);
    if (cc.customer.telegram_id) await sendTelegramMessage(cc.customer.telegram_id, buildOrderCreatedMessage("withdraw", Number((order as any).amount)));
  } catch {
    /* xabar best-effort */
  }

  return NextResponse.json({ ok: true, orderId });
}
