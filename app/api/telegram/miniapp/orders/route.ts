import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { sendTelegramMessage, buildOrderCreatedMessage } from "@/lib/telegram/notify";
import { notifyOperatorsNewOrder } from "@/lib/telegram/notifyStaff";
import { bumpCardUsage } from "@/lib/payments/cardUsage";
import { pickRequisiteForOrder, bumpPartnerRequisiteUsage, recordRequisiteReveal } from "@/lib/payments/pickRequisite";
import { checkCustomerBlocked } from "@/lib/customers/abandonBlock";
import { checkCustomerNameMatch } from "@/lib/customers/nameCheckGate";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { findCashdeskPlayer } from "@/lib/cashdesk/client";
import { resolveOrderCashdesk } from "@/lib/cashdesk/pickCashdesk";
import { getSlaMinutes } from "@/lib/cashdesk/sla";
import { getTimezone, startOfDayInTimezone } from "@/lib/site/timezone";

const PAYMENT_METHODS = ["click", "payme", "card", "crypto"] as const;


export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-order-create:${ip}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  // W1.1: paymentOperatorId/receivedAccountNumber/receivedHolderName endi
  // MIJOZDAN qabul qilinmaydi — ilgari mijoz o'zi ko'rgan kartani "aynan
  // shu edi" deb qaytarib yuborardi va server buni tekshirmasdan ishonardi.
  // Endi rekvizit shu endpoint ICHIDA, server tomonda tanlanadi (pastda).
  const { initData, type, platform, accountId, amount, paymentMethod, withdrawCode, payoutDetails, recipientName } = body ?? {};

  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const customer = cc.customer;

  // W1.3: ketma-ket to'lovsiz (expired) buyurtma ochgan mijoz vaqtincha bloklangan.
  const block = await checkCustomerBlocked(customer.id);
  if (block.blocked) {
    return NextResponse.json({ error: "temporarily_blocked", until: block.until }, { status: 403 });
  }

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
  // W2.1: rekvizitsiz withdraw buyurtmasi YARATILMAYDI — mijoz "pulni
  // qayerga olaman" javobini endi PAYOUTDAN OLDIN beradi (rekvizit
  // buyurtma bilan birga keladi, keyingi alohida "details" qadami yo'q).
  if (type === "withdraw" && (!payoutDetails || String(payoutDetails).trim().length === 0)) {
    return NextResponse.json({ error: "invalid_payout_details" }, { status: 400 });
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

  // W1.4: mijozning ro'yxatdan o'tgan ismi bilan cashdesk'dan kelgan
  // player_name'ni yumshoq solishtiramiz. playerName topilmagan bo'lsa
  // (cashdesk sozlanmagan/tarmoq xatosi) solishtirish umuman bo'lmaydi.
  if (playerName) {
    const nameCheck = await checkCustomerNameMatch(customer.id, customer.full_name, playerName, String(platform).trim(), String(accountId).trim());
    if (!nameCheck.allowed) {
      return NextResponse.json({ error: nameCheck.reason }, { status: 403 });
    }
  }

  const adminForLimits = createAdminClient();

  // BOSHQARUV MARKAZI global kill-switch: super admin to'ldirish/yechish
  // qabulини vaqtincha o'chira oladi. Kalit yo'q/xato -> ochiq (default).
  // Best-effort — oqimни buzmaydi.
  try {
    const { data: swRow } = await adminForLimits.from("site_settings").select("value").eq("key", "betcore_switches").maybeSingle();
    const sw = (swRow?.value as any) ?? {};
    if (type === "topup" && sw.topup === false) return NextResponse.json({ error: "topup_disabled" }, { status: 403 });
    if (type === "withdraw" && sw.withdraw === false) return NextResponse.json({ error: "withdraw_disabled" }, { status: 403 });
  } catch {
    /* kill-switch best-effort */
  }

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

  // Server UTC'da ishlaydi (Vercel) — "bugun" ni site_settings.timezone
  // (standart Asia/Tashkent) bo'yicha hisoblaymiz, aks holda kunlik limit
  // Toshkentda ertalab 05:00 da yangilanardi.
  const startOfToday = startOfDayInTimezone(new Date(), await getTimezone());
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

  // W1.1/W1.6: topup uchun rekvizit AYNAN SHU YERDA, server tomonda
  // tanlanadi (platforma va hamkor mijozlari bir xil fair-rotation
  // mantig'idan o'tadi — pickRequisiteForOrder). Rekvizit topilmasa
  // (faol karta yo'q) buyurtma umuman yaratilmaydi — bo'sh/soxta
  // rekvizit bilan ochilib qolmaydi.
  let requisite: Awaited<ReturnType<typeof pickRequisiteForOrder>> = null;
  if (type === "topup") {
    requisite = await pickRequisiteForOrder(paymentMethod, cc.partnerId ?? null);
    if (!requisite) {
      return NextResponse.json({ error: "no_payment_method_available" }, { status: 503 });
    }
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
      payment_operator_id: requisite?.operatorId ?? null,
      received_account_number: requisite?.accountNumber ?? null,
      received_holder_name: requisite?.holderName ?? null,
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

  // 4-BOSQICH: egasi bор mijoz buyurtmasiga SLA (javob berish muddati).
  // Owner operator shu muddatда javob bermasa/band bo'lsa -> cron handoff
  // ochadi. Egasiz buyurtmaда SLA yo'q (u umumiy navbatда). Alohida
  // best-effort update: sla_deadline ustuni yo'q bo'lsa oqim buzilmaydi.
  if (ownerOperatorId) {
    try {
      const slaMin = await getSlaMinutes();
      await supabase
        .from("telegram_orders")
        .update({ sla_deadline: new Date(Date.now() + slaMin * 60000).toISOString() })
        .eq("id", order.id);
    } catch {
      /* SLA best-effort */
    }
  }

  await sendTelegramMessage(customer.telegram_id, buildOrderCreatedMessage(type, amountNum));
  await notifyOperatorsNewOrder(type, amountNum, playerName ?? String(accountId).trim());

  // W1.1/W1.2: fair-rotation bump + "har ko'rsatish qayd etiladi" audit yozuvi.
  // Best-effort — bu ikkalasi ham buyurtma yaratishni bloklamasligi kerak
  // (pul/buyurtma allaqachon amalga oshgan, tashqi audit yozuvi ikkinchi darajali).
  if (type === "topup" && requisite) {
    try {
      if (requisite.isPartner) await bumpPartnerRequisiteUsage(requisite.methodRowId);
      else await bumpCardUsage(String(requisite.operatorId), requisite.accountNumber);
      await recordRequisiteReveal({
        customerId: customer.id,
        orderId: order.id,
        methodType: paymentMethod,
        picked: requisite,
        ip,
      });
    } catch {
      /* bump/audit best-effort */
    }
  }

  return NextResponse.json({
    order,
    // W1.1: mijoz endi rekvizitni mustaqil GET /payment-info orqali emas,
    // shu javobdan oladi (topup uchun).
    requisite:
      type === "topup" && requisite
        ? { accountNumber: requisite.accountNumber, holderName: requisite.holderName, methodType: paymentMethod }
        : null,
  });
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
  const BASE_COLUMNS = "id, type, platform, account_id, amount, payment_method, status, operator_note, created_at, operator_id, claimed_by";
  let orders: any[] | null;
  let ordersError: any;
  ({ data: orders, error: ordersError } = await supabase
    .from("telegram_orders")
    .select(`${BASE_COLUMNS}, payout_status, payout_attempt_count`)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(50));
  if (ordersError) {
    // payout_status/payout_attempt_count ustunlari hali yo'q (migratsiya
    // 0092 qo'yilmagan) — eski qisqa ustun ro'yxati bilan qayta so'raymiz,
    // aks holda mijozning butun buyurtma tarixi BO'SH ko'rinib qolardi.
    ({ data: orders } = await supabase
      .from("telegram_orders")
      .select(BASE_COLUMNS)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50));
  }

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

  // MoneyRail 3-bekat ("To'lov tasdiqlandi") — order_confirmations'da shu
  // buyurtma uchun HAQIQIY tasdiq (confirmed=true) bormi. Operator/izoh/summa
  // kabi ichki tafsilotlar mijozga chiqarilmaydi — faqat bitta bool.
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const confirmedIds = new Set<string>();
  if (orderIds.length) {
    const { data: confirmations } = await supabase
      .from("order_confirmations")
      .select("order_id")
      .in("order_id", orderIds)
      .eq("confirmed", true);
    for (const c of (confirmations ?? []) as any[]) confirmedIds.add(c.order_id);
  }

  const withNames = (orders ?? []).map((o: any) => {
    const opId = o.operator_id ?? o.claimed_by;
    const { operator_id, claimed_by, ...rest } = o;
    return {
      ...rest,
      payout_status: o.payout_status ?? "none",
      payout_attempt_count: o.payout_attempt_count ?? 0,
      operator_name: opId ? nameById.get(opId) ?? null : null,
      payment_confirmed: confirmedIds.has(o.id),
    };
  });

  return NextResponse.json({ orders: withNames });
}
