import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { findCashdeskPlayer } from "@/lib/cashdesk/client";

const PAYMENT_METHODS = ["click", "payme", "card", "crypto"] as const;

async function resolveCustomer(initData: string, botToken: string) {
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return null;
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, telegram_id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  return customer;
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-order-create:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, type, platform, accountId, amount, paymentMethod, withdrawCode, payoutDetails, recipientName } = body ?? {};

  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const customer = await resolveCustomer(initData, botToken);
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

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
      player_name: playerName,
      currency_id: currencyId,
    })
    .select("id, type, platform, account_id, amount, payment_method, status, created_at")
    .single();

  if (error || !order) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  const label = type === "topup" ? "Hisob to'ldirish" : "Pul yechish";
  await sendTelegramMessage(
    customer.telegram_id,
    `✅ ${label} buyurtmangiz qabul qilindi.\n\nSumma: ${amountNum.toLocaleString("ru-RU")}\nHolat: Kutilmoqda\n\nOperator tez orada ko'rib chiqadi — natija shu yerda va ilovada "Buyurtmalarim" bo'limida ko'rinadi.`
  );

  return NextResponse.json({ order });
}

export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const customer = await resolveCustomer(initData, botToken);
  if (!customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("telegram_orders")
    .select("id, type, platform, account_id, amount, payment_method, status, operator_note, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ orders: orders ?? [] });
}
