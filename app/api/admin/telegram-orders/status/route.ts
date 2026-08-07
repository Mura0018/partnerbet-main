import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage, buildOrderResolvedMessage } from "@/lib/telegram/notify";
import { cashdeskDeposit, isCashdeskConfigured } from "@/lib/cashdesk/client";
import { getCashdeskCredsById, type Creds } from "@/lib/cashdesk/store";
import { enforceDebtLimit } from "@/lib/cashdesk/debt";
import { applyRating } from "@/lib/cashdesk/oversight";

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
  // Rad etish uchun SABAB majburiy — mijoz nima uchun rad etilganини bilsin.
  if (status === "rejected" && (!note || !String(note).trim())) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
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

  // 3-BOSQICH: buyurtmaga biriktirilgan kassa kalitlari bilan bajarish.
  // cashdesk_id bo'sh (eski buyurtma) / ustun yo'q / kassa topilmasa ->
  // orderCreds undefined -> client default kassaga tushadi (orqaga moslik).
  let orderCreds: Creds | undefined = undefined;
  let orderCashdeskId: string | null = null;
  let handoffFrom: string | null = null; // 6-BOSQICH: takeover bo'lган bo'lsa asl owner
  let payoutStatus = "none"; // W2: withdraw uchun payout holat-mashinasi
  try {
    const { data: cdRow } = await admin
      .from("telegram_orders")
      .select("cashdesk_id, handoff_from_operator_id, payout_status")
      .eq("id", orderId)
      .maybeSingle();
    orderCashdeskId = (cdRow as any)?.cashdesk_id ?? null;
    handoffFrom = (cdRow as any)?.handoff_from_operator_id ?? null;
    payoutStatus = (cdRow as any)?.payout_status ?? "none";
    if (orderCashdeskId) {
      const c = await getCashdeskCredsById(orderCashdeskId);
      if (c) orderCreds = c;
    }
  } catch {
    /* default kassa / ustun yo'q */
  }

  // W2.2/W2.6: withdraw uchun "Mijozga pul yuborish" (shu endpoint,
  // status=completed) "1xbetdan yechib olish" (alohida
  // /api/admin/telegram-orders/payout endpointi) MUVAFFAQIYATLI
  // bo'lmaguncha OCHILMAYDI. Mijoz ham, operator ham cashdeskPayout'ni
  // endi shu yerdan HECH QACHON chaqira olmaydi (faqat o'sha alohida
  // endpoint chaqiradi).
  if (status === "completed" && pendingOrder.type === "withdraw" && payoutStatus !== "success") {
    return NextResponse.json({ error: "payout_not_done", payoutStatus }, { status: 400 });
  }

  if (status === "completed" && (await isCashdeskConfigured())) {
    if (pendingOrder.type === "withdraw") {
      // payoutStatus === "success" ekani yuqorida allaqachon tekshirildi —
      // pul ALLAQACHON /api/admin/telegram-orders/payout orqali ketgan,
      // shuning uchun cashdeskPayout bu yerda QAYTA CHAQIRILMAYDI (ikki
      // marta pul chiqmasin). Operator faqat mijozga to'lovni tasdiqladi.
      operatorNote = operatorNote
        ? `${operatorNote} ("1xbetdan yechib olish" tugmasi orqali bajarilgan)`
        : "1xbetdan yechilgan, operator to'lovni tasdiqladi";
    } else {
      // Topup (Deposit) — o'zgarishsiz, "Tasdiqlash" bosilganda shu yerda bajariladi.
      const result = await cashdeskDeposit(pendingOrder.account_id, Number(pendingOrder.amount), orderCreds, orderCashdeskId ?? undefined);

      if (!result.ok) {
        // Pul harakati muvaffaqiyatsiz bo'lsa buyurtmani completed qilmaymiz.
        return NextResponse.json({ error: "cashdesk_failed", detail: result.error }, { status: 502 });
      }
      // W3.5: QURUQ REJIM yoqiq — real pul KO'CHMAGAN, shuning uchun
      // buyurtma HAQIQATAN "completed" deb belgilanmasin (aks holda
      // mijoz to'lov olmagan holda "bajarildi" ko'rinardi).
      if ((result as any).dryRun) {
        return NextResponse.json({ error: "dry_run_active", detail: "cashdesk_dry_run yoqiq — real Deposit chaqirilmadi" }, { status: 409 });
      }
      autoProcessed = true;
      operatorNote = operatorNote
        ? `${operatorNote} (API orqali avtomatik bajarildi)`
        : "API orqali avtomatik bajarildi";
    }
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
    // W1.3: mijoz buyurtmani muvaffaqiyatli yakunladi — abandon-streak nolga.
    try {
      await admin.from("customers").update({ abandoned_streak: 0 }).eq("id", (order as any).customer_id);
    } catch {
      /* streak-reset best-effort */
    }
  }

  // 6-BOSQICH: QARZ. Buyurtma takeover bilan olingan (handoffFrom bор) VA uni
  // bajargan operator (check.userId) asl owner'dan boshqa bo'lsa -> pul
  // bajargan operator (creditor) kassasidan ketdi -> asl owner (debtor)
  // qarzdor. Owner o'zi bajarsa handoffFrom bo'sh -> qarz yo'q. Avtomatik,
  // best-effort (asosiy oqimni buzmaydi). order_id unique -> dublikat bo'lmaydi.
  if (status === "completed" && handoffFrom && handoffFrom !== check.userId) {
    try {
      await admin.from("operator_debts").insert({
        debtor_operator_id: handoffFrom,
        creditor_operator_id: check.userId,
        order_id: orderId,
        amount: Number(pendingOrder.amount),
        cashdesk_id: orderCashdeskId,
        status: "open",
      });
      await enforceDebtLimit(admin, handoffFrom);
    } catch {
      /* qarz yozish best-effort */
    }
  }

  // 7-BOSQICH: REYTING (best-effort).
  //  - completed -> buyurtmani bajargan operatorga +1 (vaqtida ish).
  //  - rejected  -> agar telefon tasdiqида "Ha" degan qayd bор bo'lsa,
  //    tasdiqlagan operatorga -5 (yolg'on tasdiq: tasdiqlagan buyurtma rad etildi).
  try {
    if (status === "completed") {
      await applyRating(admin, check.userId, 1, orderId, "Buyurtma bajarildi");
    } else if (status === "rejected") {
      const { data: conf } = await admin
        .from("order_confirmations")
        .select("operator_id")
        .eq("order_id", orderId)
        .eq("confirmed", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const confirmer = (conf as any)?.operator_id;
      if (confirmer) await applyRating(admin, confirmer, -5, orderId, "Yolg'on tasdiq (tasdiqlangan buyurtma rad etildi)");
    }
  } catch {
    /* reyting best-effort */
  }

  const telegramId = (order as any).customers?.telegram_id;
  if (telegramId) {
    await sendTelegramMessage(telegramId, buildOrderResolvedMessage(order.type, Number(order.amount), status, note));
  }

  return NextResponse.json({ success: true, autoProcessed });
}
