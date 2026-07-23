import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { sendTelegramMessage, buildOrderCreatedMessage } from "@/lib/telegram/notify";
import { notifyOperatorsNewOrder } from "@/lib/telegram/notifyStaff";
import { bumpCardUsage } from "@/lib/payments/cardUsage";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { findCashdeskPlayer } from "@/lib/cashdesk/client";
import { resolveOrderCashdesk } from "@/lib/cashdesk/pickCashdesk";

const PAYMENT_METHODS = ["click", "payme", "card", "crypto"] as const;


export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-order-create:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, type, platform, accountId, amount, paymentMethod, withdrawCode, payoutDetails, recipientName, paymentOperatorId, receivedAccountNumber, receivedHolderName } = body ?? {};

  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const customer = cc.customer;

  if (type !== "topup" && type !== "withdraw") {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (!platform || String(platform).trim().length === 0) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }
  if (!accountId || String(accountId).trim().length === 0) {
    return NextResponse.json({ error: "invalid_account_id" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });
  }
  if (type === "withdraw" && (!withdrawCode || String(withdrawCode).trim().length === 0)) {
    return NextResponse.json({ error: "invalid_withdraw_code" }, { status: 400 });
  }
  if (type === "withdraw" && (!recipientName || String(recipientName).trim().length === 0)) {
    return NextResponse.json({ error: "invalid_recipient_name" }, { status: 400 });
  }

  // If the cashdesk API is configured, verify the account_id is a real
  // player before creating the order — this is what catches a mistyped
  // ID up front instead of the operator discovering it later. If the API
  // isn't configured yet, or the lookup itself fails (network, etc), we
  // don't block order creation — this stays optional/best-effort so the
  // manual flow keeps working exactly as before until credentials are set.
  let playerName: string | null = null;
  let currencyId: string | null = null;
  const lookup = await findCashdeskPlayer(String(accountId).trim());
  if (lookup.ok) {
    playerName = lookup.data.name ?? null;
    currencyId = lookup.data.currencyId != null ? String(lookup.data.currencyId) : null;
  } else if (lookup.error !== "not_configured" && lookup.error !== "network_error" && lookup.error !== "request_failed") {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  const adminForLimits = createAdminClient();
  const { count: pendingCountExact } = await adminForLimits
    .from("telegram_orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id)
    .eq("status", "pending");
  if ((pendingCountExact ?? 0) >= 3) {
    return NextResponse.json({ error: "too_many_pending_orders" }, { status: 400 });
  }

  // 2-BOSQICH: egasi bор mijoz -> buyurtma AVTOMATIK o'z operatoriga
  // (mavjud claimed_by yumshoq-biriktirish mexanizmi orqali). SLA/handoff/lock
  // YO'Q (u 4-bosqichda). Egasi YO'Q (yangi mijoz) -> claimed_by=null, ya'ni
  // hozirgi mavjud oqim aynan avvalgidek.
  const { data: ownerRow } = await adminForLimits
    .from("customers")
    .select("owner_operator_id")
    .eq("id", customer.id)
    .maybeSingle();
  const ownerOperatorId = (ownerRow as any)?.owner_operator_id ?? null;

  const { data: limitsRow } = await adminForLimits.from("site_settings").select("value").eq("key", "betcore_pay_limits").maybeSingle();
  const limits = (limitsRow?.value as any) ?? {};
  const maxOrderAmount = Number(limits.max_order_amount) || Infinity;
  const dailyCustomerLimit = Number(limits.daily_customer_limit) || Infinity;

  if (amountNum > maxOrderAmount) {
    return NextResponse.json({ error: "order_limit_exceeded", limit: maxOrderAmount }, { status: 400 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data: todaysOrders } = await adminForLimits
    .from("telegram_orders")
    .select("amount")
    .eq("customer_id", customer.id)
    .in("status", ["pending", "completed"])
    .gte("created_at", startOfToday.toISOString());
  const todaysTotal = (todaysOrders ?? []).reduce((sum, o: any) => sum + Number(o.amount), 0);
  if (todaysTotal + amountNum > dailyCustomerLimit) {
    return NextResponse.json({ error: "daily_limit_exceeded", limit: dailyCustomerLimit }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("telegram_orders")
    .insert({
      customer_id: customer.id,
      type,
      platform: String(platform).trim().slice(0, 50),
      account_id: String(accountId).trim().slice(0, 50),
      amount: amountNum,
      payment_method: paymentMethod,
      withdraw_code: type === "withdraw" ? String(withdrawCode).trim().slice(0, 20) : null,
      payout_details: payoutDetails ? String(payoutDetails).trim().slice(0, 500) : null,
      recipient_name: type === "withdraw" ? String(recipientName).trim().slice(0, 150) : null,
      payment_operator_id: type === "topup" && paymentOperatorId ? String(paymentOperatorId) : null,
      received_account_number: type === "topup" && receivedAccountNumber ? String(receivedAccountNumber).trim().slice(0, 100) : null,
      received_holder_name: type === "topup" && receivedHolderName ? String(receivedHolderName).trim().slice(0, 150) : null,
      player_name: playerName,
      currency_id: currencyId,
      partner_id: cc.partnerId,
      claimed_by: ownerOperatorId,
      claimed_at: ownerOperatorId ? new Date().toISOString() : null,
    })
    .select("id, type, platform, account_id, amount, payment_method, status, created_at")
    .single();

  if (error || !order) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  // 3-BOSQICH: buyurtmaga kassa biriktirish. Egasi bор mijoz -> owner
  // operator kassasi (egalik buzilmaydi); yangi mijoz -> balansi eng kam
  // aktiv kassa. Best-effort: cashdesk_id ustuni hali yo'q / kassa yo'q /
  // balans olinmasa -> bo'sh qoladi (bajarilishда default kassa). Buyurtma
  // yaratish HECH QACHON bloklanmaydi.
  try {
    const cashdeskId = await resolveOrderCashdesk(ownerOperatorId);
    if (cashdeskId) {
      await supabase.from("telegram_orders").update({ cashdesk_id: cashdeskId }).eq("id", order.id);
    }
  } catch {
    /* kassa biriktirish best-effort */
  }

  await sendTelegramMessage(customer.telegram_id, buildOrderCreatedMessage(type, amountNum));
  await notifyOperatorsNewOrder(type, amountNum, playerName ?? String(accountId).trim());
  if (type === "topup" && paymentOperatorId && receivedAccountNumber) {
    await bumpCardUsage(String(paymentOperatorId), String(receivedAccountNumber).trim());
  }

  return NextResponse.json({ order });
}

export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const customer = cc.customer;

  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("telegram_orders")
    .select("id, type, platform, account_id, amount, payment_method, status, operator_note, created_at, operator_id, claimed_by")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // F2b: kartaning orqa tomonida "qaysi operator" ko'rsatish uchun operator
  // ismini qo'shamiz (operator_id, aks holda claimed_by bo'yicha).
  const opIds = Array.from(
    new Set((orders ?? []).map((o: any) => o.operator_id ?? o.claimed_by).filter(Boolean))
  );
  const nameById = new Map<string, string>();
  if (opIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name, full_name").in("id", opIds);
    for (const p of profs ?? []) nameById.set(p.id, p.display_name || p.full_name || "Operator");
  }
  const withNames = (orders ?? []).map((o: any) => {
    const opId = o.operator_id ?? o.claimed_by;
    const { operator_id, claimed_by, ...rest } = o;
    return { ...rest, operator_name: opId ? nameById.get(opId) ?? null : null };
  });

  return NextResponse.json({ orders: withNames });
}
